export const fields = {
 age: null,
 region: ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'],
 household: ['single','couple','family','unknown'],
 work: ['employee','self','unemployed','retired','unknown'],
 income: ['low','middle','high','unknown'],
 home: ['rent','own','other','unknown'],
 vulnerable: ['yes','no','unknown'],
 interest: ['all','pension','health','housing','job','living']
};
export function validateAnswers(a) {
 if (!a || typeof a !== 'object' || Array.isArray(a)) throw Error('답변 형식이 올바르지 않습니다.');
 if (!Number.isInteger(a.age) || a.age < 40 || a.age > 79) throw Error('나이는 40~79세로 입력해 주세요.');
 for (const [k, values] of Object.entries(fields)) if (values && !values.includes(a[k])) throw Error('8개 질문에 모두 답해 주세요.');
 return Object.fromEntries(Object.keys(fields).map(k=>[k,a[k]]));
}
export function validateRules(r) {
 if (!r || typeof r !== 'object' || Array.isArray(r)) throw Error('규칙은 JSON 객체여야 합니다.');
 for (const [k,v] of Object.entries(r)) {
  if (['minAge','maxAge'].includes(k)) { if (!Number.isInteger(v)||v<0||v>120) throw Error('연령 규칙 오류'); }
  else if (k==='requiresReview') { if(typeof v!=='boolean') throw Error('requiresReview는 boolean입니다.'); }
  else if (!fields[k] || k==='interest' || !Array.isArray(v) || !v.length || v.some(x=>!fields[k].includes(x)||x==='unknown')) throw Error('지원하지 않는 규칙: '+k);
 }
 if(r.minAge!==undefined&&r.maxAge!==undefined&&r.minAge>r.maxAge) throw Error('연령 범위 오류');
 return r;
}
export function evaluate(benefit,a, today=new Date().toISOString().slice(0,10)) {
 const r=typeof benefit.rules_json==='string'?JSON.parse(benefit.rules_json):benefit.rules_json;
 const reasons=[]; let mismatch=false, unknown=false;
 if(r.minAge!==undefined&&a.age<r.minAge){mismatch=true;reasons.push(`안내 연령은 ${r.minAge}세 이상입니다.`);}
 if(r.maxAge!==undefined&&a.age>r.maxAge){mismatch=true;reasons.push(`안내 연령은 ${r.maxAge}세 이하입니다.`);}
 for(const k of ['region','household','work','income','home','vulnerable']) if(r[k]) {
  if(a[k]==='unknown'){unknown=true;reasons.push('답하지 못한 조건의 확인이 필요합니다.');}
  else if(!r[k].includes(a[k])){mismatch=true;reasons.push('입력한 정보와 일부 안내 조건이 다릅니다.');}
 }
 const stale=!benefit.last_verified_at||benefit.last_verified_at>today||(Date.parse(today)-Date.parse(benefit.last_verified_at)>180*86400000);
 if(benefit.is_sample) reasons.push('검증 전 샘플 데이터입니다. 공식 안내를 확인해 주세요.');
 if(stale) reasons.push('최근 공식 정보 확인이 필요합니다.');
 if(r.requiresReview) reasons.push('소득인정액·재산·가입 이력 등 별도 심사가 필요합니다.');
 const status=mismatch?'info':(unknown||stale||benefit.is_sample||r.requiresReview)?'review':'likely';
 if(!reasons.length) reasons.push('입력한 정보가 등록된 기본 조건에 맞습니다. 최종 자격은 기관에서 확인합니다.');
 return {...benefit,status,reasons:[...new Set(reasons)],preferred:a.interest==='all'||a.interest===benefit.category};
}
