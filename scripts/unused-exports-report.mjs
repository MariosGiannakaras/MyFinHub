import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const typescriptModule=require('typescript');
const ts=typescriptModule?.createSourceFile?typescriptModule:typescriptModule?.default;
if(!ts?.createSourceFile||!ts?.forEachChild)throw new Error('TypeScript parser API is unavailable through the package namespace or default export.');

const root=process.cwd();
const candidateRoots=['src','server','api'];
const consumerRoots=['src','server','api','tests','scripts','desktop'];
const rootConsumers=['vite.config.ts'];
const sourceExtensions=new Set(['.ts','.tsx','.mts','.cts']);

function normalize(file){return path.normalize(file);}
function isSourceFile(file){return sourceExtensions.has(path.extname(file))&&!file.endsWith('.d.ts');}
function walk(dir,target){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name==='.git'||entry.name==='dist'||entry.name==='coverage')continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full,target);
    else if(isSourceFile(full))target.add(normalize(full));
  }
}
function parse(file,source){
  const kind=file.endsWith('.tsx')?ts.ScriptKind.TSX:file.endsWith('.mts')?ts.ScriptKind.MTS:file.endsWith('.cts')?ts.ScriptKind.CTS:ts.ScriptKind.TS;
  return ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,kind);
}
function modifier(node,kind){
  const modifiers=ts.canHaveModifiers(node)?ts.getModifiers(node):undefined;
  return Boolean(modifiers?.some(item=>item.kind===kind));
}
function bindingNames(name,target){
  if(ts.isIdentifier(name)){target.add(name.text);return;}
  for(const element of name.elements){
    if(ts.isOmittedExpression(element))continue;
    bindingNames(element.name,target);
  }
}
function resolveRelative(fromFile,specifier,fileSet){
  if(!specifier.startsWith('.'))return null;
  const base=path.resolve(path.dirname(fromFile),specifier);
  const ext=path.extname(base);
  const candidates=[];
  if(['.js','.jsx','.mjs','.cjs'].includes(ext)){
    const stem=base.slice(0,-ext.length);
    candidates.push(stem+'.ts',stem+'.tsx',stem+'.mts',stem+'.cts');
  }else if(ext){
    candidates.push(base);
  }else{
    candidates.push(
      base+'.ts',base+'.tsx',base+'.mts',base+'.cts',
      path.join(base,'index.ts'),path.join(base,'index.tsx'),path.join(base,'index.mts'),path.join(base,'index.cts')
    );
  }
  return candidates.map(normalize).find(candidate=>fileSet.has(candidate))??null;
}
function moduleText(node){
  return node&&ts.isStringLiteralLike(node)?node.text:null;
}
function collectExports(sourceFile){
  const names=new Set();
  for(const statement of sourceFile.statements){
    if(ts.isExportAssignment(statement)){
      if(!statement.isExportEquals)names.add('default');
      continue;
    }
    if(ts.isExportDeclaration(statement)){
      const clause=statement.exportClause;
      if(clause&&ts.isNamedExports(clause)){
        for(const item of clause.elements)names.add(item.name.text);
      }else if(clause&&'name' in clause&&clause.name?.text){
        names.add(clause.name.text);
      }
      continue;
    }
    if(!modifier(statement,ts.SyntaxKind.ExportKeyword))continue;
    const isDefault=modifier(statement,ts.SyntaxKind.DefaultKeyword);
    if(isDefault){names.add('default');continue;}
    if(ts.isVariableStatement(statement)){
      for(const declaration of statement.declarationList.declarations)bindingNames(declaration.name,names);
      continue;
    }
    if((ts.isFunctionDeclaration(statement)||ts.isClassDeclaration(statement)||ts.isInterfaceDeclaration(statement)||ts.isTypeAliasDeclaration(statement)||ts.isEnumDeclaration(statement)||ts.isModuleDeclaration(statement))&&statement.name){
      names.add(statement.name.text);
    }
  }
  return names;
}
function frameworkOwnedExport(baseRoot,file,name){
  const relative=path.relative(baseRoot,file).replaceAll(path.sep,'/');
  if(!relative.startsWith('api/'))return false;
  return name==='default'||name==='config'||name==='runtime'||name==='maxDuration';
}
function analyze(baseRoot,sources,candidateFiles){
  const fileSet=new Set(sources.keys());
  const parsed=new Map([...sources].map(([file,source])=>[file,parse(file,source)]));
  const exportsByFile=new Map();
  const usedByFile=new Map();
  const usedAll=new Set();

  for(const file of candidateFiles){
    exportsByFile.set(file,collectExports(parsed.get(file)));
    usedByFile.set(file,new Set());
  }
  const use=(target,name)=>{
    if(!target||!candidateFiles.has(target))return;
    usedByFile.get(target).add(name);
  };
  const useAll=(target)=>{
    if(target&&candidateFiles.has(target))usedAll.add(target);
  };

  for(const [file,sourceFile] of parsed){
    for(const statement of sourceFile.statements){
      if(ts.isImportDeclaration(statement)){
        const specifier=moduleText(statement.moduleSpecifier);
        const target=specifier?resolveRelative(file,specifier,fileSet):null;
        const clause=statement.importClause;
        if(target&&clause){
          if(clause.name)use(target,'default');
          if(clause.namedBindings){
            if(ts.isNamespaceImport(clause.namedBindings))useAll(target);
            else for(const item of clause.namedBindings.elements)use(target,item.propertyName?.text??item.name.text);
          }
        }
      }else if(ts.isExportDeclaration(statement)){
        const specifier=moduleText(statement.moduleSpecifier);
        const target=specifier?resolveRelative(file,specifier,fileSet):null;
        if(target){
          const clause=statement.exportClause;
          if(!clause||!ts.isNamedExports(clause))useAll(target);
          else for(const item of clause.elements)use(target,item.propertyName?.text??item.name.text);
        }
      }else if(ts.isImportEqualsDeclaration(statement)&&ts.isExternalModuleReference(statement.moduleReference)){
        const specifier=moduleText(statement.moduleReference.expression);
        if(specifier)useAll(resolveRelative(file,specifier,fileSet));
      }
    }

    const visit=(node)=>{
      if(ts.isCallExpression(node)&&node.arguments.length===1){
        const specifier=moduleText(node.arguments[0]);
        if(specifier&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require'))){
          useAll(resolveRelative(file,specifier,fileSet));
        }
      }else if(ts.isImportTypeNode(node)){
        const literal=ts.isLiteralTypeNode(node.argument)?moduleText(node.argument.literal):null;
        if(literal)useAll(resolveRelative(file,literal,fileSet));
      }
      ts.forEachChild(node,visit);
    };
    ts.forEachChild(sourceFile,visit);
  }

  const findings=[];
  for(const file of [...candidateFiles].sort()){
    if(usedAll.has(file))continue;
    const used=usedByFile.get(file);
    for(const name of [...(exportsByFile.get(file)??[])].sort()){
      if(used.has(name)||frameworkOwnedExport(baseRoot,file,name))continue;
      findings.push({file,name});
    }
  }
  return findings;
}

function selfTest(){
  const fixtureRoot=path.join(root,'__unused_exports_fixture__');
  const file=(...parts)=>normalize(path.join(fixtureRoot,...parts));
  const sources=new Map([
    [file('src','a.ts'),"export const used=1; export const dead=2; export type Shape={x:number}; export default function main(){}"],
    [file('src','consumer.ts'),"import main,{used,type Shape} from './a'; console.log(main,used); const value:Shape={x:1};"],
    [file('src','namespace.ts'),"export const x=1; export const y=2;"],
    [file('tests','namespace.test.ts'),"import * as values from '../src/namespace'; console.log(values.x);"],
    [file('api','route.ts'),"export default function handler(){}; export const config={runtime:'nodejs'};"],
  ]);
  const candidates=new Set([file('src','a.ts'),file('src','namespace.ts'),file('api','route.ts')]);
  const actual=analyze(fixtureRoot,sources,candidates).map(item=>path.relative(fixtureRoot,item.file).replaceAll(path.sep,'/')+'::'+item.name);
  const expected=['src/a.ts::dead'];
  if(JSON.stringify(actual)!==JSON.stringify(expected)){
    throw new Error('Unused-export analyzer sanity check failed: '+JSON.stringify(actual));
  }
}
selfTest();

const allFiles=new Set();
for(const sourceRoot of consumerRoots)walk(path.join(root,sourceRoot),allFiles);
for(const relative of rootConsumers){
  const full=normalize(path.join(root,relative));
  if(fs.existsSync(full)&&isSourceFile(full))allFiles.add(full);
}
const candidateFiles=new Set();
for(const sourceRoot of candidateRoots){
  const prefix=normalize(path.join(root,sourceRoot))+path.sep;
  for(const file of allFiles)if(file.startsWith(prefix))candidateFiles.add(file);
}
const sources=new Map([...allFiles].map(file=>[file,fs.readFileSync(file,'utf8')]));
const findings=analyze(root,sources,candidateFiles);

if(findings.length){
  console.log('Unused-export baseline: '+findings.length+' conservative finding(s) across '+candidateFiles.size+' candidate module(s). Report-only until Stage-6 classification is complete.');
  for(const finding of findings){
    console.log(' - '+path.relative(root,finding.file).replaceAll(path.sep,'/')+' :: '+finding.name);
  }
}else{
  console.log('Unused-export baseline: 0 conservative findings across '+candidateFiles.size+' candidate module(s).');
}
