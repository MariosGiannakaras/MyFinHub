import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const ts=require('typescript');
if(!ts?.ScriptTarget||!ts?.createSourceFile)throw new Error('TypeScript compiler API unavailable from require("typescript")');

const root=process.cwd();
const baselinePath=path.join(root,'docs/code-health/code-hygiene-baseline.json');
const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));

const productionRoots=['src','server','api'];
const usageRoots=['src','server','api','tests','scripts'];
const sourceExts=new Set(['.ts','.tsx','.mts','.cts','.js','.jsx','.mjs','.cjs']);
const productionExts=new Set(['.ts','.tsx','.mts','.cts']);

const toRepoPath=file=>path.relative(root,file).split(path.sep).join('/');
const walk=(relativeRoot,exts)=>{
  const start=path.join(root,relativeRoot);
  if(!fs.existsSync(start))return [];
  const out=[];
  const visit=dir=>{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      if(entry.name==='node_modules'||entry.name==='dist'||entry.name==='.git'||entry.name==='.performance-dist')continue;
      const full=path.join(dir,entry.name);
      if(entry.isDirectory())visit(full);
      else if(exts.has(path.extname(entry.name))&&!entry.name.endsWith('.d.ts'))out.push(full);
    }
  };
  visit(start);
  return out;
};

const productionFiles=[...new Set(productionRoots.flatMap(dir=>walk(dir,productionExts)))].sort();
const usageFiles=[...new Set(usageRoots.flatMap(dir=>walk(dir,sourceExts)))].sort();
const productionSet=new Set(productionFiles.map(file=>path.resolve(file)));

const scriptKind=file=>{
  if(file.endsWith('.tsx'))return ts.ScriptKind.TSX;
  if(file.endsWith('.jsx'))return ts.ScriptKind.JSX;
  if(file.endsWith('.js')||file.endsWith('.mjs')||file.endsWith('.cjs'))return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
};
const parse=file=>ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,scriptKind(file));

const resolveRelative=(fromFile,specifier)=>{
  if(!specifier.startsWith('.'))return null;
  const basePath=path.resolve(path.dirname(fromFile),specifier);
  const ext=path.extname(basePath);
  const candidates=[];
  const add=value=>{if(!candidates.includes(value))candidates.push(value);};
  add(basePath);
  if(ext){
    const stem=basePath.slice(0,-ext.length);
    if(['.js','.jsx','.mjs','.cjs'].includes(ext)){
      for(const replacement of ['.ts','.tsx','.mts','.cts'])add(stem+replacement);
    }
  }else{
    for(const suffix of ['.ts','.tsx','.mts','.cts','.js','.jsx','.mjs','.cjs'])add(basePath+suffix);
    for(const suffix of ['.ts','.tsx','.mts','.cts','.js','.jsx','.mjs','.cjs'])add(path.join(basePath,'index'+suffix));
  }
  for(const candidate of candidates){
    if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile())return path.resolve(candidate);
  }
  return null;
};

const hasModifier=(node,kind)=>node.modifiers?.some(mod=>mod.kind===kind)??false;
const exportedNames=new Map();
const addExport=(file,name)=>{
  if(!name||name==='default')return;
  if(!exportedNames.has(file))exportedNames.set(file,new Set());
  exportedNames.get(file).add(name);
};
const collectBindingNames=(name,out)=>{
  if(ts.isIdentifier(name)){out.push(name.text);return;}
  for(const element of name.elements){
    if(ts.isBindingElement(element))collectBindingNames(element.name,out);
  }
};

const externalEntrypoint=file=>{
  const rel=toRepoPath(file);
  return rel==='src/main.tsx'||rel==='src/qa.tsx'||rel==='server/index.ts'||/^api\/[^/]+\.ts$/.test(rel);
};

for(const file of productionFiles){
  if(externalEntrypoint(file))continue;
  const source=parse(file);
  for(const statement of source.statements){
    if(ts.isExportDeclaration(statement)){
      if(statement.moduleSpecifier)continue;
      if(statement.exportClause&&ts.isNamedExports(statement.exportClause)){
        for(const specifier of statement.exportClause.elements)addExport(file,specifier.name.text);
      }
      continue;
    }
    if(!hasModifier(statement,ts.SyntaxKind.ExportKeyword)||hasModifier(statement,ts.SyntaxKind.DefaultKeyword))continue;
    if(ts.isFunctionDeclaration(statement)||ts.isClassDeclaration(statement)||ts.isInterfaceDeclaration(statement)||ts.isTypeAliasDeclaration(statement)||ts.isEnumDeclaration(statement)||ts.isModuleDeclaration(statement)){
      if(statement.name)addExport(file,statement.name.text);
      continue;
    }
    if(ts.isVariableStatement(statement)){
      for(const declaration of statement.declarationList.declarations){
        const names=[];collectBindingNames(declaration.name,names);for(const name of names)addExport(file,name);
      }
    }
  }
}

const usedExports=new Map();
const markUsed=(target,name)=>{
  if(!target||!productionSet.has(target))return;
  if(!usedExports.has(target))usedExports.set(target,new Set());
  usedExports.get(target).add(name);
};
const runtimeEdges=new Map(productionFiles.map(file=>[path.resolve(file),new Set()]));
const addRuntimeEdge=(from,target)=>{
  const fromAbs=path.resolve(from);
  if(!target||!productionSet.has(target)||!runtimeEdges.has(fromAbs))return;
  runtimeEdges.get(fromAbs).add(target);
};

for(const file of usageFiles){
  const source=parse(file);
  const visit=node=>{
    if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)){
      const target=resolveRelative(file,node.moduleSpecifier.text);
      const clause=node.importClause;
      if(clause?.namedBindings){
        if(ts.isNamespaceImport(clause.namedBindings))markUsed(target,'*');
        else for(const specifier of clause.namedBindings.elements)markUsed(target,(specifier.propertyName??specifier.name).text);
      }
      let typeOnly=clause?.isTypeOnly??false;
      if(clause?.namedBindings&&ts.isNamedImports(clause.namedBindings)&&!clause.name){
        typeOnly=clause.namedBindings.elements.length>0&&clause.namedBindings.elements.every(item=>item.isTypeOnly);
      }
      if(!typeOnly)addRuntimeEdge(file,target);
    }else if(ts.isExportDeclaration(node)&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
      const target=resolveRelative(file,node.moduleSpecifier.text);
      if(node.exportClause&&ts.isNamedExports(node.exportClause)){
        for(const specifier of node.exportClause.elements)markUsed(target,(specifier.propertyName??specifier.name).text);
      }else markUsed(target,'*');
      let typeOnly=node.isTypeOnly;
      if(node.exportClause&&ts.isNamedExports(node.exportClause)){
        typeOnly=typeOnly||(node.exportClause.elements.length>0&&node.exportClause.elements.every(item=>item.isTypeOnly));
      }
      if(!typeOnly)addRuntimeEdge(file,target);
    }else if(ts.isImportTypeNode(node)&&ts.isLiteralTypeNode(node.argument)&&ts.isStringLiteral(node.argument.literal)){
      markUsed(resolveRelative(file,node.argument.literal.text),'*');
    }else if(ts.isCallExpression(node)&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0])){
      const isDynamic=node.expression.kind===ts.SyntaxKind.ImportKeyword;
      const isRequire=ts.isIdentifier(node.expression)&&node.expression.text==='require';
      if(isDynamic||isRequire){
        const target=resolveRelative(file,node.arguments[0].text);
        markUsed(target,'*');
        addRuntimeEdge(file,target);
      }
    }
    ts.forEachChild(node,visit);
  };
  visit(source);
}

const unusedExports=[];
for(const [file,names] of exportedNames){
  const used=usedExports.get(path.resolve(file))??new Set();
  if(used.has('*'))continue;
  for(const name of names){
    if(!used.has(name))unusedExports.push(`${toRepoPath(file)}#${name}`);
  }
}
unusedExports.sort();

let index=0;
const stack=[];
const indices=new Map();
const lowLinks=new Map();
const onStack=new Set();
const components=[];
const strongConnect=node=>{
  indices.set(node,index);lowLinks.set(node,index);index+=1;stack.push(node);onStack.add(node);
  for(const next of runtimeEdges.get(node)??[]){
    if(!indices.has(next)){strongConnect(next);lowLinks.set(node,Math.min(lowLinks.get(node),lowLinks.get(next)));}
    else if(onStack.has(next))lowLinks.set(node,Math.min(lowLinks.get(node),indices.get(next)));
  }
  if(lowLinks.get(node)===indices.get(node)){
    const component=[];
    while(stack.length){
      const item=stack.pop();onStack.delete(item);component.push(item);
      if(item===node)break;
    }
    const selfLoop=component.length===1&&(runtimeEdges.get(component[0])?.has(component[0])??false);
    if(component.length>1||selfLoop)components.push(component);
  }
};
for(const file of runtimeEdges.keys())if(!indices.has(file))strongConnect(file);
const runtimeCycles=components.map(component=>component.map(toRepoPath).sort().join(' | ')).sort();

const normalizeBaseline=value=>Array.isArray(value)?[...new Set(value)].sort():[];
const expectedUnused=normalizeBaseline(baseline.unusedExports);
const expectedCycles=normalizeBaseline(baseline.runtimeCycles);
const delta=(actual,expected)=>({
  unexpected:actual.filter(item=>!expected.includes(item)),
  stale:expected.filter(item=>!actual.includes(item)),
});
const unusedDelta=delta(unusedExports,expectedUnused);
const cycleDelta=delta(runtimeCycles,expectedCycles);

console.log(`Code hygiene graph: ${productionFiles.length} production modules, ${unusedExports.length} baselined unused exports, ${runtimeCycles.length} runtime cycle groups.`);
const printDelta=(label,value)=>{
  if(value.unexpected.length)console.error(`\nUnexpected ${label}:\n${value.unexpected.map(item=>`- ${item}`).join('\n')}`);
  if(value.stale.length)console.error(`\nStale ${label} baseline entries (remove them):\n${value.stale.map(item=>`- ${item}`).join('\n')}`);
};
printDelta('unused exports',unusedDelta);
printDelta('runtime cycles',cycleDelta);

if(process.argv.includes('--write-baseline')){
  const next={unusedExports,runtimeCycles};
  fs.writeFileSync(baselinePath,JSON.stringify(next,null,2)+'\n');
  console.log(`Updated ${toRepoPath(baselinePath)}.`);
  process.exit(0);
}

if(unusedDelta.unexpected.length||unusedDelta.stale.length||cycleDelta.unexpected.length||cycleDelta.stale.length){
  console.error('\nCode-hygiene baseline mismatch. Review the findings; fix real debt or update the checked-in baseline deliberately.');
  process.exit(1);
}
