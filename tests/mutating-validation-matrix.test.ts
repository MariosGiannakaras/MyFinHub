import { describe, expect, it } from 'vitest';
import { assertImportConfirmation } from '../api/import.js';
import { parseHistoryMoveRequest } from '../api/history.js';
import {
  parseAccountMetadataExpectedRevision,
  parseAccountMetadataWrite,
  parseFinancialProviderWrite,
  parseProviderAssetBindingWrite,
  parseProviderAssetUpload,
} from '../server/accountMetadataHandler.js';
import { parseAccountSecurityWrite } from '../server/accountSecurityHandler.js';
import { parseCardVaultRequest } from '../server/cardVaultHandler.js';
import { parseDeviceSessionAction } from '../server/deviceSessionsHandler.js';
import { ApiError, readJsonBody } from '../server/http.js';
import { parseExpectedHistoryGeneration, parseExpectedRevision } from '../server/storage.js';
import { parseMutableWrite } from '../server/stateValidation.js';
import { validateCompleteFinanceData } from '../server/financeDataValidation.js';

function expect400(run:()=>unknown,code:string){
  try{
    run();
    throw new Error('expected validation failure');
  }catch(error){
    expect(error).toBeInstanceOf(ApiError);
    const apiError=error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe(code);
    expect(apiError.expose).toBe(true);
    expect(apiError.message.trim().length).toBeGreaterThan(0);
  }
}

describe('mutating API validation matrix',()=>{
  it('fails malformed finance write envelopes and preconditions before persistence',()=>{
    expect400(()=>parseMutableWrite(null),'INVALID_DATA');
    expect400(()=>parseExpectedRevision('-1'),'INVALID_REVISION');
    expect400(()=>parseExpectedHistoryGeneration('not-a-generation'),'INVALID_HISTORY_GENERATION');
  });

  it('fails malformed account/provider metadata writes with stable task-local codes',()=>{
    expect400(()=>parseAccountMetadataWrite({accountId:'../../bad',iban:null}),'INVALID_ACCOUNT_ID');
    expect400(()=>parseAccountMetadataExpectedRevision('9007199254740992'),'INVALID_REVISION');
    expect400(()=>parseFinancialProviderWrite({id:'../bad',displayName:'Bad',shortName:'Bad',providerKind:'bank',sortOrder:1}),'INVALID_FINANCIAL_PROVIDER');
    expect400(()=>parseProviderAssetUpload({query:{providerId:'demo-bank',role:'logo',variant:'dark'},headers:{'content-type':'image/png'}}),'INVALID_PROVIDER_ASSET');
    expect400(()=>parseProviderAssetBindingWrite({providerId:'demo-bank',role:'logo',variant:'blue',assetKey:'asset'}),'INVALID_PROVIDER_ASSET_BINDING');
  });

  it('fails malformed account-security and device-session mutations deterministically',()=>{
    expect400(()=>parseAccountSecurityWrite({action:'email',email:'not-an-email'}),'INVALID_EMAIL');
    expect400(()=>parseDeviceSessionAction({action:'revoke',sessionId:'not-a-uuid'}),'INVALID_DEVICE_SESSION_ID');
  });

  it('fails malformed card-vault mutations without accepting unknown or unsafe identities',()=>{
    expect400(()=>parseCardVaultRequest({cardId:'../../bad'},'POST'),'INVALID_CARD_ID');
    expect400(()=>parseCardVaultRequest({cardId:'card-1',pan:1234},'PUT'),'INVALID_CARD_PAN');
    expect400(()=>parseCardVaultRequest({cardId:'card-1',unexpected:true},'DELETE'),'INVALID_CARD_SECRET_REQUEST');
  });

  it('fails malformed history/import mutations at their route validation boundaries',()=>{
    expect400(()=>parseHistoryMoveRequest({action:'delete',updatedAt:'2026-10-02'}),'INVALID_HISTORY');
    expect400(()=>parseHistoryMoveRequest({action:'undo',updatedAt:'2026-10-02',extra:true}),'INVALID_HISTORY');
    expect400(()=>assertImportConfirmation(''),'IMPORT_CONFIRMATION_REQUIRED');
  });

  it('fails malformed imported finance documents before database mutation',()=>{
    expect400(()=>validateCompleteFinanceData({app:'RheomIQ',schemaVersion:999}),'INVALID_DATA');
  });

  it('maps malformed JSON bodies to the canonical 400 envelope before route parsing',async()=>{
    await expect(readJsonBody({headers:{'content-length':'1'},body:'{'},1024))
      .rejects.toMatchObject({status:400,code:'INVALID_JSON',expose:true});
  });
});
