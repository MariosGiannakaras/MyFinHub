import {describe,expect,it} from 'vitest';
import {rovingRadioTypeaheadDestination,rovingTabDestination} from '../src/lib/rovingTabDestination.js';

const labels=['Τράπεζα Πειραιώς','Alpha Bank','Εθνική Τράπεζα','Eurobank','Επιλογή παρόχου'];

describe('shared roving radio typeahead (Greek/Latin)',()=>{
  it('finds the next matching bank, wrapping with case and accent folding',()=>{
    expect(rovingRadioTypeaheadDestination('a',0,labels)).toBe(1);
    expect(rovingRadioTypeaheadDestination('Α',0,labels)).toBeNull();
    expect(rovingRadioTypeaheadDestination('ε',1,labels)).toBe(2);
    expect(rovingRadioTypeaheadDestination('Ε',2,labels)).toBe(4);
    expect(rovingRadioTypeaheadDestination('έ',4,labels)).toBe(2);
    expect(rovingRadioTypeaheadDestination('a',4,labels)).toBe(1);
  });
  it('ignores controls, spacing and invalid indices without changing selection',()=>{
    for(const key of ['ArrowDown','Enter',' ','Escape',''])expect(rovingRadioTypeaheadDestination(key,0,labels)).toBeNull();
    expect(rovingRadioTypeaheadDestination('A',-1,labels)).toBeNull();
    expect(rovingRadioTypeaheadDestination('A',0,[])).toBeNull();
    expect(rovingRadioTypeaheadDestination('Z',0,labels)).toBeNull();
  });
  it('preserves accepted Arrow/Home/End keyboard movement',()=>{
    expect(rovingTabDestination('ArrowRight',4,5)).toBe(0);
    expect(rovingTabDestination('Home',3,5)).toBe(0);
    expect(rovingTabDestination('End',1,5)).toBe(4);
  });
});
