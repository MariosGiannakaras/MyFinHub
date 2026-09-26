import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root=process.cwd();
const sourceRoots=['src','server','api'];
const extensions=['.ts','.tsx','.mts','.cts'];
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
  if(ext==='.js')candidates.push(base.slice(0,-3)+'.ts',base.slice(0,-3)+'.tsx');
  else if(ext==='.jsx')candidates.push(base.slice(0,-4)+'.tsx',base.slice(0,-4)+'.ts');
  else if(ext==='.mjs')candidates.push(base.slice(0,-4)+'.mts',base.slice(0,-4)+'.ts');
  else if(ext==='.cjs')candidates.push(base.slice(0,-4)+'.cts',base.slice(0,-4)+'.ts');
  else if(ext)candidates.push(base);
  else{
    for(const sourceExt of extensions)candidates.push(base+sourceExt);
    for(const sourceExt of extensions)candidates.push(path.join(base,'index'+sourceExt));
  }
  return candidates.map(path.normalize).find(candidate=>fileSet.has(candidate))??null;
}

function importClauseIsTypeOnly(clause){
  if(!clause)return false;
  if(clause.isTypeOnly)return true;
  if(clause.name)return false;
  const bindings=clause.namedBindings;
  return Boolean(bindings&&ts.isNamedImports(bindings)&&bindings.elements.length>0&&bindings.elements.every(element=>element.isTypeOnly));
}

function exportClauseIsTypeOnly(node){
  if(node.isTypeOnly)return true;
  const clause=node.exportClause;
  return Boolean(clause&&ts.isNamedExports(clause)&&clause.elements.length>0&&clause.elements.every(element=>element.isTypeOnly));
}

function moduleSpecifiers(source,fileName='fixture.ts'){
  const sourceFile=ts.createSourceFile(fileName,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const specs=new Set();

  function addModuleSpecifier(node){
    if(node&&ts.isStringLiteralLike(node))specs.add(node.text);
  }

  function visit(node){
    if(ts.isImportDeclaration(node)){
      if(!importClauseIsTypeOnly(node.importClause))addModuleSpecifier(node.moduleSpecifier);
    }else if(ts.isExportDeclaration(node)){
      if(!exportClauseIsTypeOnly(node))addModuleSpecifier(node.moduleSpecifier);
    }else if(ts.isImportEqualsDeclaration(node)){
      if(!node.isTypeOnly&&ts.isExternalModuleReference(node.moduleReference))addModuleSpecifier(node.moduleReference.expression);
    }else if(ts.isCallExpression(node)&&node.arguments.length===1){
      const arg=node.arguments[0];
      if(node.expression.kind===ts.SyntaxKind.ImportKeyword)addModuleSpecifier(arg);
      else if(ts.isIdentifier(node.expression)&&node.expression.text==='require')addModuleSpecifier(arg);
    }
    ts.forEachChild(node,visit);
  }
  visit(sourceFile);
  return [...specs].sort();
}

const parserFixture=[
  "import type { A } from './type-a';",
  "import { type B, type C } from './type-b';",
  "export type { D } from './type-c';",
  "export { type E } from './type-d';",
  "import { type F, G } from './mixed';",
  "import './side-effect';",
  "export { H } from './runtime-export';",
  "const lazy=import('./dynamic');",
  "const cjs=require('./cjs-runtime');",
  "const fake=\"import('./string-false-positive')\";",
  "// import './comment-false-positive';",
].join('\n');
const fixtureSpecs=moduleSpecifiers(parserFixture);
const expectedFixture=['./cjs-runtime','./dynamic','./mixed','./runtime-export','./side-effect'].sort();
if(JSON.stringify(fixtureSpecs)!==JSON.stringify(expectedFixture)){
  throw new Error('Dependency-cycle AST sanity check failed: '+JSON.stringify(fixtureSpecs));
}

const graph=new Map();
for(const file of files){
  const deps=new Set();
  for(const specifier of moduleSpecifiers(fs.readFileSync(file,'utf8'),file)){
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
