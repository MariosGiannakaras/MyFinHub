import { describe, expect, it } from 'vitest';
import { ApiError, copyBoundedBinaryValue, readBinaryBody } from '../server/http.js';

describe('bounded binary HTTP bodies',()=>{
  it('copies supported binary values into an owned Buffer',()=>{
    const source=Buffer.from([1,2,3]);
    const result=copyBoundedBinaryValue(source,3);
    expect(result).toEqual(source);
    expect(result).not.toBe(source);
    source[0]=9;
    expect(result[0]).toBe(1);
  });

  it('rejects ambiguous object/array values instead of trusting request parameter shapes',()=>{
    for(const value of [[1,2,3],{length:3},42,null]){
      expect(()=>copyBoundedBinaryValue(value,16)).toThrow(ApiError);
    }
  });

  it('enforces the byte limit for direct bodies',async()=>{
    await expect(readBinaryBody({headers:{'content-length':'4'},body:Buffer.alloc(4)},3))
      .rejects.toMatchObject({status:413,code:'PAYLOAD_TOO_LARGE'});
    await expect(readBinaryBody({headers:{},body:Buffer.alloc(4)},3))
      .rejects.toMatchObject({status:413,code:'PAYLOAD_TOO_LARGE'});
  });

  it('rejects malformed Content-Length before consuming the body',async()=>{
    await expect(readBinaryBody({headers:{'content-length':'4x'},body:Buffer.from('ok')},16))
      .rejects.toMatchObject({status:400,code:'INVALID_CONTENT_LENGTH'});
    await expect(readBinaryBody({headers:{'content-length':'9007199254740992'},body:Buffer.from('ok')},16))
      .rejects.toMatchObject({status:400,code:'INVALID_CONTENT_LENGTH'});
  });

  it('accepts bounded async-iterable chunks and rejects an overflowing stream',async()=>{
    const request={
      headers:{},
      async *[Symbol.asyncIterator](){yield Buffer.from('ab');yield new Uint8Array([99]);},
    };
    await expect(readBinaryBody(request,3)).resolves.toEqual(Buffer.from('abc'));

    const tooLarge={
      headers:{},
      async *[Symbol.asyncIterator](){yield Buffer.from('ab');yield Buffer.from('cd');},
    };
    await expect(readBinaryBody(tooLarge,3)).rejects.toMatchObject({status:413,code:'PAYLOAD_TOO_LARGE'});
  });
});
