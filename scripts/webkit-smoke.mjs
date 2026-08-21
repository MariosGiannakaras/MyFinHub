import { mkdirSync } from 'node:fs';
import { webkit } from 'playwright';

const baseUrl=process.env.RHEOMIQ_QA_URL||'http://127.0.0.1:5173/qa.html';
const evidenceDir=process.env.MYFINHUB_WEBKIT_EVIDENCE_DIR||'/tmp/myfinhub-webkit-smoke';
mkdirSync(evidenceDir,{recursive:true});

const assert=(value,message)=>{if(!value)throw new Error(`WebKit smoke assertion failed: ${message}`)};
const browser=await webkit.launch({headless:true});

async function makePage(viewport){
  const context=await browser.newContext({viewport,colorScheme:'light',locale:'el-GR',reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(`pageerror: ${error.message}`));
  page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`)});
  const assertHealthy=label=>assert(errors.length===0,`${label} runtime errors: ${errors.join(' | ')}`);
  return {context,page,assertHealthy};
}

async function noOverflow(page,label){
  const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth);
  assert(overflow<=1,`${label} horizontal overflow ${overflow}px`);
}

async function desktopSmoke(){
  const {context,page,assertHealthy}=await makePage({width:1280,height:900});
  try{
    console.log('WebKit smoke: Login and MFA semantics');
    await page.goto(`${baseUrl}?screen=login`,{waitUntil:'networkidle'});
    await page.locator('#login-title').waitFor();
    assert((await page.locator('body').innerText()).includes('MyFinHub'),'login keeps MyFinHub identity');
    await page.getByRole('button',{name:'Εμφάνιση κωδικού'}).click();
    assert(await page.locator('#login-password').getAttribute('type')==='text','password reveal works');
    await noOverflow(page,'desktop login');

    await page.goto(`${baseUrl}?screen=mfa`,{waitUntil:'networkidle'});
    await page.locator('#mfa-title').waitFor();
    const mfa=page.locator('#mfa-code');
    await mfa.waitFor();
    assert(await mfa.evaluate(node=>node===document.activeElement),'MFA code receives focus');
    await mfa.fill('123456');
    assert(await page.getByRole('button',{name:'Επαλήθευση',exact:true}).isEnabled(),'MFA submit enables for six digits');
    assertHealthy('auth');

    console.log('WebKit smoke: owned controls, modal focus, mutation and undo');
    await page.goto(`${baseUrl}?page=dashboard&motion=reduced`,{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Οι λογαριασμοί μου'}).waitFor();
    assert((await page.locator('body').innerText()).includes('MyFinHub'),'desktop shell keeps MyFinHub identity');
    await page.getByRole('button',{name:'Γρήγορη προσθήκη'}).click();
    const quick=page.locator('[aria-labelledby="quick-add-title"]');
    await quick.waitFor();
    const amount=quick.locator('input[data-autofocus="true"]');
    assert(await amount.evaluate(node=>node===document.activeElement),'Quick Add focuses amount');

    const account=quick.getByRole('combobox',{name:'Λογαριασμός'});
    await account.click();
    await page.locator('.owned-select-popover').waitFor();
    assert(await page.getByRole('listbox',{name:'Επιλογές'}).isVisible(),'app-owned select listbox opens');
    await page.keyboard.press('Escape');
    await page.locator('.owned-select-popover').waitFor({state:'detached'});

    const date=quick.getByLabel('Ημερομηνία');
    await date.click();
    await page.locator('.owned-date-popover').waitFor();
    assert(await page.getByRole('grid',{name:'Ημερολόγιο'}).isVisible(),'app-owned date grid opens');
    await page.keyboard.press('Escape');
    await page.locator('.owned-date-popover').waitFor({state:'detached'});

    await amount.fill('12.34');
    await quick.getByPlaceholder('Σύντομη περιγραφή μόνο αν χρειάζεται').fill('WebKit QA Expense');
    await quick.getByRole('button',{name:'Καταχώριση',exact:true}).click();
    await quick.waitFor({state:'detached'});
    await page.locator('.sidebar nav').getByRole('button',{name:'Συναλλαγές'}).click();
    await page.getByRole('heading',{name:'Συναλλαγές'}).waitFor();
    await page.getByText('WebKit QA Expense',{exact:true}).first().waitFor();
    const undo=page.getByRole('button',{name:'Αναίρεση τελευταίας αλλαγής'});
    assert(await undo.isEnabled(),'new mutation exposes undo');
    await undo.click();
    await page.getByText('WebKit QA Expense',{exact:true}).first().waitFor({state:'detached'});

    console.log('WebKit smoke: Reports and accessible chart alternative');
    await page.locator('.sidebar nav').getByRole('button',{name:'Αναφορές'}).click();
    await page.getByRole('heading',{name:/Αναφορές/}).waitFor();
    assert(await page.locator('.report-chart-frame').isVisible(),'Reports chart renders in WebKit');
    assert(await page.locator('details.chart-alt').count()>0,'Reports keeps text chart alternative');
    await noOverflow(page,'desktop Reports');
    await page.screenshot({path:`${evidenceDir}/webkit-desktop-reports.png`,fullPage:true});
    assertHealthy('desktop workspace');
  }finally{await context.close()}
}

async function mobileSmoke(){
  const {context,page,assertHealthy}=await makePage({width:390,height:844});
  try{
    console.log('WebKit smoke: narrow-mobile navigation and modal containment');
    await page.goto(`${baseUrl}?page=dashboard&motion=reduced`,{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:'Οι λογαριασμοί μου'}).waitFor();
    assert(await page.locator('.mobile-nav').isVisible(),'mobile navigation is visible');
    await noOverflow(page,'mobile dashboard');

    await page.getByRole('button',{name:'Άνοιγμα γρήγορης καταχώρισης'}).click();
    const quick=page.locator('[aria-labelledby="quick-add-title"]');
    await quick.waitFor();
    assert(await quick.locator('input[data-autofocus="true"]').evaluate(node=>node===document.activeElement),'mobile Quick Add focuses amount');
    await noOverflow(page,'mobile Quick Add');
    await page.keyboard.press('Escape');
    await quick.waitFor({state:'detached'});

    await page.getByRole('button',{name:'Περισσότερες ενότητες'}).click();
    const more=page.locator('[aria-labelledby="mobile-more-title"]');
    await more.waitFor();
    await more.getByRole('button',{name:'Αναφορές'}).click();
    await page.getByRole('heading',{name:/Αναφορές/}).waitFor();
    assert(await page.locator('.report-chart-frame').isVisible(),'mobile Reports chart renders');
    await noOverflow(page,'mobile Reports');
    const targets=await page.locator('.mobile-nav button').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
    assert(targets.every(height=>height>=44),'mobile navigation touch targets stay >=44px');
    await page.screenshot({path:`${evidenceDir}/webkit-mobile-reports.png`,fullPage:true});
    assertHealthy('mobile workspace');
  }finally{await context.close()}
}

try{
  await desktopSmoke();
  await mobileSmoke();
  console.log('WebKit desktop + narrow-mobile compatibility smoke passed.');
}finally{
  await browser.close();
}
