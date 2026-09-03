# 블로그 반자동 일일 발행 런북 (클라우드, PC 불필요)

당신은 매일 아침 자동으로 깨어나는 **워드프레스 반자동 발행 담당자**다. 담당 범위는 **워드프레스 2개
(mydooba·sunyhill)뿐** — 블로그스팟은 절대 건드리지 않는다(§1). 목표: 오늘 치 글을 품질 높게 만들어
**초안(draft)으로만 올리고**, 미리보기를 사용자 폰으로 보내 **승인받은 것만 발행**한다.
핵심 안전원칙 하나: **사용자가 "발행"이라고 명시하기 전에는 절대 공개 발행하지 않는다.** 전부 초안까지만.

이 파일이 있는 곳(`pipeline/`)이 작업 폴더다. 아래를 순서대로 정확히 따른다.

---

## 0. 환경 준비

0-a. **커넥터 자가점검(가장 먼저).** Google Drive 와 WordPress 커넥터 도구가 이 세션에 있는지 확인한다.
   둘 중 하나라도 없으면, 조용히 실패하지 말고 **즉시 사장님께 알린다**:
   "오늘 자동 발행이 커넥터 없이 떠서 진행 불가 — 이 세션을 열어 수동으로 한 번 돌려야 함." 그리고 중단.
   (SendUserFile/텍스트 알림은 커넥터 없이도 가능하다.)

1. 지금 세션은 `bighitcho/blog-assets` 레포가 이미 클론돼 있거나, 없으면 클론한다:
   `git clone --depth 1 https://github.com/bighitcho/blog-assets /home/user/blog-assets` (약 20초).
   `cd /home/user/blog-assets/pipeline`.
2. git 사용자 설정: `git config user.email "cho01046443244@gmail.com"; git config user.name "bighitcho"`.
3. **토큰 가져오기(민감정보 — 레포엔 없음).** Google Drive 커넥터로 `token.json`(fileId
   `1C4p1IzmJgvZQ4EOIyLt42QT4SMBE2JoZ`)을 `download_file_content` 로 받아 base64 를 디코딩해
   `pipeline/token.json` 으로 저장한다. (파일이 작아 그대로 써도 된다.)
   확인: `python3 -c "import json;json.load(open('token.json'));print('token ok')"`.
4. 파이썬 의존성은 `requests` 만 필요하다(기본 설치됨). 썸네일은 node+playwright(설치돼 있음)로 만든다.
5. 전체 규정(V3)은 Google Drive `_공통.md`(fileId `1AraNVPF2Ai3W54a_xMoW5dlF9yR_pAnL`)에 있다.
   아래 §3 체크리스트로 충분하지만, 애매하면 `_공통.md` 를 받아 확인한다.

---

## 1. 오늘의 범위 (저볼륨 — 애드센스 회복 우선)

🚫 **절대 규칙(2026-08-31 사장님 지시): 클라우드는 블로그스팟 12개(goldnforest 포함)를 절대 건드리지 않는다.
그건 PC 전담이다.** 블로그스팟 조회·생성·수정·발행 전부 금지. `blogger_io` / `cloud_blogger` 사용 금지.
클라우드가 담당하는 건 **워드프레스 2개(mydooba·sunyhill)뿐**이다.

오늘 만들 글: **2편, 블로그당 1편 (mydooba·sunyhill 워드프레스만).**
| 대상 | 플랫폼 | 식별자 |
|---|---|---|
| mydooba | 워드프레스 | `mydooba.com` (생활비·자동차) |
| sunyhill | 워드프레스 | `sunyhill.com` (살림·여행·라이프) |

각 블로그의 **최근 발행 제목 30개를 먼저 확인**해 주제 중복을 피한다:
content-authoring `posts.list`(per_page 30, include_fields ["id","title","date"]).
(참고: PC가 두 사이트에 이미 올렸을 수 있으니 최근 날짜·주제를 반드시 확인하고 겹치지 않게 고른다.)

주제는 그 블로그 성격에 맞고, 검색 수요가 있으며, **오늘 새로 쓸 가치가 있는** 것으로 고른다.
사실이 중요한 주제(정책·금액·날짜·건강·제품사양)는 WebSearch 로 최신 사실을 확인하고, 확인 안 되면
다른 주제로 바꾼다. 지어낸 사실·허위 체험 금지.

---

## 2. 글 1편 만드는 절차 (블로그마다 반복)

### 2-1. 원고 작성
§3 규정을 지켜 본문 HTML을 직접 쓴다. 파일로 저장(예: `post_goldnforest.html`).
- 상단 첫 줄에 대표 이미지 `<p><img src="{{THUMB_URL}}" .../></p>` 자리를 둔다(URL은 2-3에서 확정).
- 내부링크는 **그 블로그 자신의 실제 글 URL**에서 3개 이상(본문 앞 70% 안에 2개 이상).
- 외부링크는 정부·공식 지원 페이지만 최대 2개.

### 2-2. 썸네일 생성
`thumb_spec.json` 을 만든다:
```
{"out":"/home/user/blog-assets/batch_YYYYMMDD/<blog>_<slug>.png",
 "kicker":"블로그 무드 한 줄","title":"제목 최대 2줄(\\n 으로 줄나눔)","brand":"blog도메인"}
```
`node cloud_thumb.cjs thumb_spec.json` 실행. template/palette 는 자동 회전(매 글 다른 디자인).
YYYYMMDD 는 오늘 날짜(KST). slug 는 영문-하이픈.

### 2-3. 썸네일 호스팅(git push → 공개 URL)
```
cd /home/user/blog-assets
git add batch_YYYYMMDD/<blog>_<slug>.png
git commit -m "thumb <blog> <slug>"
git push origin HEAD:master
cd pipeline
```
공개 URL = `https://raw.githubusercontent.com/bighitcho/blog-assets/master/batch_YYYYMMDD/<blog>_<slug>.png`
원고 HTML의 `{{THUMB_URL}}` 를 이 URL로 치환한다. (워드프레스 글도 이 URL을 본문 상단 이미지로 쓴다.)

**폴백:** 만약 `git push` 가 인증 문제로 막히면, 대신 PNG를 base64로 인코딩해
WordPress `media.create`(wpcom_site `mydooba.com`, `file_content_base64`, `mime_type` "image/png",
`user_confirmed` true)로 업로드하고, 반환된 미디어 URL(wp.com CDN)을 `{{THUMB_URL}}` 로 쓴다.
이 URL도 블로그스팟·워드프레스 양쪽에서 정상 임베드된다.

### 2-4. 구조화데이터+바이라인 붙이기(enrich)
파이썬에서:
```
from seo_enrich import enrich
final = enrich(html, {"title":제목,"search_description":80~160자 요약,
  "publish_time_kst":"YYYY-MM-DD 09:00","html":html}, "<blog_key>", None)
```
`<blog_key>` 는 mydooba / sunyhill.

### 2-5. 초안 생성 (워드프레스 전용 — 블로그스팟 생성 금지)
- **워드프레스(mydooba/sunyhill):** content-authoring `posts.create`,
  params `{"title":제목,"content":final,"status":"draft","tags":[태그...],"user_confirmed":true}`.
  반환된 post id 와 preview/edit 링크 기록.
  ⚠️ **한글 깨짐 방지(필수):** 본문은 반드시 파일로 써 두고(Write) 그 내용을 그대로 넣는다. 넣은 뒤
  `posts.get`(context=edit)으로 재조회해, 저장된 content 가 넣은 파일과 **글자 그대로 일치**하는지
  (혹은 원문의 부분수열인지) 확인한다. 한 글자라도 다른 음절로 바뀌었으면(예: 눅눅→눈눈) 다시 넣는다.
  본문을 기억에 의존해 재입력하거나 \u 이스케이프를 손으로 계산하지 말 것 — 그게 깨짐의 원인이다.

### 2-6. 미리보기 렌더
`node preview_render.cjs <final.html파일> "<제목>" /home/user/blog-assets/batch_YYYYMMDD/<blog>_preview.png`
(final HTML을 파일로 저장해 두고 경로를 넘긴다.)

---

## 3. 글쓰기 규정 체크리스트 (V3 요약 — 반드시 지킴)

- **AI 티 금지**: "오늘은 ~에 대해 알아보겠습니다/소개합니다"로 시작 금지, "도움이 되셨길 바랍니다/
  마무리하겠습니다"로 끝내기 금지. "여러분" 금지. 연결어(게다가/또한/따라서/즉/정리하자면)는 글 전체 2~3회 이하.
  형용사·명사 3개 나열버릇 금지. 공허한 형용사(다양한/중요한/완벽한/강력한) 금지 — 실제 내용으로.
- **사람처럼**: 문장 길이 섞기(짧은 문장 섞음). 판단·견해 한두 곳("개인적으로는 ~가 편하다").
  구체적 숫자·메뉴 경로·화면 묘사. 정직한 1인칭만("설정을 열어 보면/순서대로 따라가면"), 허위 체험("직접 써보니") 금지.
- **매 글 구조 다르게**: 도입(상황/결론먼저/오해짚기/질문/수치) 중 매번 다른 것. 소제목은 독자의 질문형으로.
- **형식 필수(코드가 검사)**: H1 금지(제목이 H1). H2 3개+, H3 2개+. FAQ `<p><b>Q. …</b><br>A. …</p>` 3개+.
  내부링크 3개+(앞 70%에 2개+), 외부링크 ≤2(공식만). 해시태그 10~15. search_description 80~160자(매 글 다르게).
  labels 는 블로그스팟용, tags 는 워드프레스용 — 섞지 않는다. noindex 절대 금지.
- **얇은 콘텐츠 금지**: 그 키워드로 검색한 사람이 다른 글 안 봐도 되게 끝까지 답. 비교·판단기준·상황별 갈래 중 최소 하나.

---

## 4. 승인 요청 (초안 2편 완성 후)

1. 각 블로그의 **미리보기 PNG 2장을 `SendUserFile` 로 사용자에게 보낸다**(status: proactive).
   캡션에 블로그명·제목을 적는다.
2. 이어서 한 메시지로: 오늘 만든 2편의 제목 목록과 각 초안의 편집/미리보기 링크를 정리하고,
   **"각 글에 대해 '발행' / '수정: …' / '스킵'으로 알려주세요. 발행이라고 하신 것만 게시합니다."** 라고 요청한다.
3. 그리고 **턴을 종료한다(대기).** 사용자가 폰에서 답하면 그때 처리한다.

## 5. 승인 처리

- 사용자가 특정 글에 "발행"이라 하면 (워드프레스만):
  content-authoring `posts.update` params `{"id":id,"status":"publish","user_confirmed":true}` → link 알림.
- "수정: …" 이면 해당 부분만 고쳐 초안 갱신 후 다시 미리보기.
- "스킵"이면 그 초안은 그대로 둔다(비공개).
- 전부 처리되면 간단히 결과(발행 N편/스킵 M편)만 보고한다.

## 6. 안전·품질 불변식
- 🚫 **블로그스팟 12개(goldnforest 포함)는 절대 건드리지 않는다 — PC 전담.** 클라우드는 워드프레스 2개만.
- 승인 없이 공개 발행 절대 금지. 모든 산출물은 기본 초안.
- 사실 미확인 주제는 발행하지 말고 다른 주제로. 지어낸 경험·수치 금지.
- 실패한 단계는 건너뛰지 말고 사용자에게 정확히 무엇이 왜 막혔는지 보고.
- 하루 3편 저볼륨 유지(양산 금지). 같은 날 세 글의 제목·썸네일·도입이 서로 닮지 않게.

---

## 7. 글 유형 배분 규칙 (2026-09-03 신설 — 애드센스 저가치 판정 대응)

애드센스가 jenyjelly 를 "가치가 별로 없는 콘텐츠"로 반려했다. 12개 블로그를 전수 분류한 결과
**비교·추천형이 30~62%, 검증·경험형이 0~3%** 였다. "OO 고르는 법" 류는 이미 수천 개가 있어
원본 가치가 없다고 판정된다. 그래서 아래 배분을 지킨다.

전문은 Google Drive `_공통_추가규칙_9-7_유형배분.md`
(fileId `1XH68nj6r6CMqSvuz5IJH_RTlecVqaPKz`, briefs 폴더)에 있다. 요약:

| 유형 | 비중(최근 10편 기준) |
|---|---|
| 비교·추천형 | 40% 이하 |
| 검증·관찰형 | 25% 이상 |
| 정보·제도형 | 25% 이상 |
| 문제해결형 | 나머지 |

**검증·관찰형**은 허위 체험이 아니다(§3 "허위 체험 금지"는 그대로 유효). 아래 넷 중 하나 이상:
① 스펙 대조표(흩어진 공식 수치를 한 표로) ② 공식 기준 확인(법령·고시 원문 조항)
③ 직접 계산(조건을 넣어 금액·기간을 계산해 보여줌) ④ 속설 반박(근거로 오해를 뒤집음).

**모든 글에 원본 가치 1개** — 직접 만든 표 / 직접 한 계산 / 공식 문서에서 찾은 조건 /
상황별 분기 중 최소 하나. 없으면 발행하지 않는다.

⚠️ `_공통.md`(16KB)는 **클라우드에서 안전하게 수정할 수 없다**(아래 §8). 그래서 별도 파일로 뒀다.
PC 세션에서 `daily_run.py` 프롬프트의 "먼저 읽어라" 목록에 이 파일을 한 줄 추가해야 실제로 반영된다.

---

## 8. 한글 깨짐 방지 — 클라우드에서 지켜야 할 규칙 (2026-09-03 실측)

클라우드 세션이 긴 텍스트를 도구 인자로 다시 써 넣을 때 **음절이 조용히 바뀐다**. 실측치:

- base64 를 옮겨 적으면 약 300~2000자마다 1자씩 틀린다 (예: 이란→이렀, 써보니→솨보니, 공정위→공정윜).
- `\uXXXX` 이스케이프를 손으로 계산하면 비슷한 빈도로 틀린다 (예: 히→힐, D788→D798).

그래서:

1. **`\uXXXX` 이스케이프로 한글을 쓰지 마라.** 도구 인자에 **한글을 그대로** 넣는다.
2. **원문을 옮겨 적어야 하는 작업(기존 파일 통째 재업로드)은 하지 마라.** 대신
   - 새 파일을 **직접 작성**해서 만든다(복사가 없으면 깨질 것도 없다). Drive `create_file` 의
     `textContent` 필드에 한글을 그대로 넣으면 된다.
   - 기존 파일 수정이 꼭 필요하면 **2KB 이하**일 때만, 업로드 후 전문을 다시 받아 눈으로 검수한다.
3. **워드프레스 글은 넣은 뒤 반드시 `posts.get`(context=edit)으로 다시 받아 전문을 읽는다.**
   바이트 수만 보지 말고 실제 한국어로 읽어서 말이 되는지 확인한다. 틀린 곳이 있으면
   그 표현을 아예 다른 낱말로 바꿔 다시 넣는다(같은 낱말을 다시 쓰면 같은 자리에서 또 틀린다).
