# 혜택마실

공식 기관 자료를 바탕으로 복지·지원제도를 안내하는 정적 웹사이트입니다. GitHub Pages에서 운영되며, 8가지 질문 진단은 방문자의 브라우저에서만 계산됩니다.

## 운영 원칙

- 운영 데이터: `data/benefits.json` — 12개 공식 확인 제도
- 진단 로직: `assets/rules.js`, `assets/app.js` — 서버 전송·저장 없음
- 사용자 도메인: `welfare.journal5188.com`
- DNS: `welfare` CNAME → `jinyeol4u-boop.github.io`

## 업데이트

제도 변경 시 `data/benefits.json`의 제도 설명, 출처, `last_verified_at`을 함께 갱신합니다. 검색 결과에 표시되는 상세 정보는 `benefits/<번호>/index.html`에도 있으므로, 내용 변경 후에는 해당 상세 페이지와 `sitemap.xml`을 함께 점검합니다.

## GitHub Pages

Pages는 `main` 브랜치의 루트 폴더에서 배포합니다. GitHub 저장소의 **Settings → Pages → Custom domain**에 `welfare.journal5188.com`을 설정한 뒤, DNS 반영 후 **Enforce HTTPS**를 켭니다.
