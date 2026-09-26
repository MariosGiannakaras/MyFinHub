import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root=process.cwd();
const sourceRoots=['src','server','api'];
const extensions=['.ts','.tsx'];
const files=[];

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name.startsWith('.'))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(extensions.includes(path.extname(entry.name)))files.push(path.normalize(full));
  }
}
for(const sourceRoot of sourceRoots){
  const full=path.join(root,sourceRoot);
  if(fs.existsSync(full))walk(full);
}
const fileSet=new Set(files);

function resolveRelative(fromFile,specifier){
  if(!specifier.startsWith('.'))return null;
  const base=path.resolve(path.dirname(fromFile),specifier);
  const ext=path.extname(base);
  const candidates=[];
  if(['.js','.jsx','.mjs','.cjs'].includes(ext)){
    const stem=base.slice(0,-ext.length);
    candidates.push(stem+'.ts',stem+'.tsx');
  }else if(ext){
    candidates.push(base);
  }else{
    candidates.push(base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx'));
  }
  return candidates.map(path.normalize).find(candidate=>fileSet.has(candidate))??null;
}

function namedBindingsAreTypeOnly(bindings){
  return ts.isNamedImports(bindings)&&bindings.elements.length>0&&bindings.elements.every(element=>element.isTypeOnly);
}
function runtimeImport(node){
  if(!node.importClause)return true;
  if(node.importClause.isTypeOnly)return false;
  if(node.importClause.name)return true;
  const bindings=node.importClause.namedBindings;
  if(!bindings)return false;
  if(ts.isNamespaceImport(bindings))return true;
  return !namedBindingsAreTypeOnly(bindings);
}
function runtimeExport(node){
  if(node.isTypeOnly)return false;
  if(!node.exportClause)return true;
  return !ts.isNamedExports(node.exportClause)||node.exportClause.elements.some(element=>!element.isTypeOnly);
}
function runtimeSpecifiers(file,source){
  const sourceFile=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const specs=[];
  function visit(node){
    if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)&&runtimeImport(node)){
      specs.push(node.moduleSpecifier.text);
    }else if(ts.isExportDeclaration(node)&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)&&runtimeExport(node)){
      specs.push(node.moduleSpecifier.text);
    }else if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments.length===1&&ts.isStringLiteral(node.arguments[0])){
      specs.push(node.arguments[0].text);
    }
    ts.forEachChild(node,visit);
  }
  visit(sourceFile);
  return specs;
}

const graph=new Map();
for(const file of files){
  const deps=new Set();
  for(const specifier of runtimeSpecifiers(file,fs.readFileSync(file,'utf8'))){
    const resolved=resolveRelative(file,specifier);
    if(resolved)deps.add(resolved);
  }
  graph.set(file,[...deps].sort());
}

const state=new Map(),stack=[],cycles=[],seen=new Set();
function display(file){return path.relative(root,file).replaceAll(path.sep,'/');}
function canonicalCycle(nodes){
  const cycle=nodes.slice(0,-1).map(display);
  const forward=cycle.map((_,i)=>[...cycle.slice(i),...cycle.slice(0,i)]);
  const reversed=[...cycle].reverse();
  const backward=reversed.map((_,i)=>[...reversed.slice(i),...reversed.slice(0,i)]);
  const canonical=[...forward,...backward].map(items=>items.join(' -> ')).sort()[0];
  return canonical+' -> '+canonical.split(' -> ')[0];
}
function dfs(file){
  state.set(file,1);stack.push(file);
  for(const dep of graph.get(file)??[]){
    const s=state.get(dep)??0;
    if(s===0)dfs(dep);
    else if(s===1){
      const start=stack.lastIndexOf(dep);
      const key=canonicalCycle([...stack.slice(start),dep]);
      if(!seen.has(key)){seen.add(key);cycles.push(key);}
    }
  }
  stack.pop();state.set(file,2);
}
for(const file of [...files].sort())if((state.get(file)??0)===0)dfs(file);

if(cycles.length){
  console.error('Runtime dependency cycles detected ('+cycles.length+'):');
  for(const cycle of cycles.sort())console.error(' - '+cycle);
  process.exit(1);
}
console.log('Runtime dependency-cycle check passed: '+files.length+' TypeScript modules across '+sourceRoots.join(', ')+'. Type-only edges excluded.');
