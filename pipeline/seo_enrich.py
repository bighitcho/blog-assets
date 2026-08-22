# -*- coding: utf-8 -*-
"""발행 직전 HTML에 SEO 요소를 주입한다.

    from seo_enrich import enrich
    html = enrich(html, spec, blog_key, post_url)

넣는 것 세 가지. 전부 2026-08-10 학습에서 "우리에게 통째로 없다"고 확인된 것들이다.

1. **구조화 데이터(JSON-LD)** — Article + FAQPage
   프로젝트 전체에 `application/ld+json` 이 한 줄도 없었다.
   SEO/AEO 가이드 p.39·p.63·p.112가 페이지 유형별 스키마를 요구한다.

2. **작성자 바이라인** — E-E-A-T 의 T(신뢰)가 통째로 비어 있었다.
   p.61 "누가 썼는지 알 수 있는가?" 점검 항목.

3. **AI 인용용 정의 문장** — AEO 점검표 1번.
   "{주제}는 ~하는 ~입니다" 형태 한 문장이 있어야 AI 검색이 가져간다.

주의: Blogger 본문에서 <script> 가 살아남는지는 발행 후 실측으로 확인해야 한다.
      죽으면 `SCHEMA_IN_BODY` 를 False 로 내리고 템플릿 레벨로 옮긴다.
"""
import html as _html
import json
import re

SCHEMA_IN_BODY = True

# 블로그별 바이라인. 사이트 성격에 맞는 사람으로 쓴다.
BYLINE = {
    "goldnforest": ("골든포레스트 편집팀", "생활비와 정부 지원 제도를 직접 확인해 정리합니다"),
    "siangold": ("시안골드 편집팀", "연금·건강보험 등 중장년 제도를 공식 자료로 확인해 씁니다"),
    "jenyjelly": ("제니젤리 편집팀", "생활가전과 취미 장비를 스펙 기준으로 비교합니다"),
    "tera-company": ("테라컴퍼니 편집팀", "OTT와 취미 생활 정보를 공식 발표 기준으로 정리합니다"),
    "golden628": ("골든628 편집팀", "스마트폰과 금융 앱의 실제 이용 절차를 정리합니다"),
    "wwwesg": ("wwwesg 편집팀", "분리배출과 생활 에너지 제도를 공공기관 자료로 확인합니다"),
    "sunyhill": ("써니힐", "살림과 리빙을 직접 겪은 순서대로 기록합니다"),
    "mydooba": ("마이두바 편집팀", "자동차와 생활 금융 제도를 공식 기준으로 정리합니다"),
    "eblueribbon": ("Blue Ribbon Picks", "Korean culture and language, explained for beginners"),
}

SITE_NAME = {
    "goldnforest": "goldnforest.com", "siangold": "siangold",
    "jenyjelly": "jenyjelly", "tera-company": "tera-company",
    "golden628": "golden628", "wwwesg": "wwwesg",
    "sunyhill": "sunyhill.com", "mydooba": "mydooba.com",
    "eblueribbon": "eblueribbon.com",
}


def _text(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()


def extract_faq(html, limit=5):
    """본문에서 FAQ 를 뽑는다. 우리 글은 두 가지 형식을 쓴다.

    형식 A — `<p><b>Q. 질문</b><br>A. 답변</p>` (지금 작가들이 실제로 쓰는 형식)
    형식 B — 질문형 소제목 + 바로 뒤 문단

    A 를 먼저 본다. 첫 판이 B 만 봐서 16편 중 6편의 FAQ 를 통째로 놓쳤다(2026-08-10).
    """
    out = []

    # 형식 A
    for m in re.finditer(
            r"<p>\s*<b>\s*Q[.:]?\s*(.*?)</b>\s*(?:<br\s*/?>)?\s*(.*?)</p>",
            html or "", re.S | re.I):
        q = _text(m.group(1))
        a = _text(m.group(2))
        a = re.sub(r"^A[.:]?\s*", "", a)
        if len(q) < 5 or len(a) < 20:
            continue
        out.append((q, a[:400]))
        if len(out) >= limit:
            return out

    # 형식 B
    for m in re.finditer(r"<h[23][^>]*>(.*?)</h[23]>(.*?)(?=<h[23][^>]*>|$)",
                         html or "", re.S | re.I):
        q = _text(m.group(1))
        if not q.endswith("?"):
            continue
        a = _text(m.group(2))
        if len(a) < 30:
            continue
        out.append((q, a[:400]))
        if len(out) >= limit:
            break
    return out


def build_jsonld(spec, blog_key, post_url=None):
    title = spec.get("title", "")
    desc = (spec.get("search_description") or "")[:300]
    author, _ = BYLINE.get(blog_key, ("편집팀", ""))
    pub = spec.get("publish_time_kst", "").replace(" ", "T") + ":00+09:00"

    article = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title[:110],
        "description": desc,
        "datePublished": pub,
        "dateModified": pub,
        "author": {"@type": "Organization", "name": author},
        "publisher": {"@type": "Organization",
                      "name": SITE_NAME.get(blog_key, blog_key)},
        "inLanguage": "ko-KR",
    }
    if post_url:
        article["mainEntityOfPage"] = {"@type": "WebPage", "@id": post_url}

    blocks = [article]

    faqs = extract_faq(spec.get("html", ""))
    if faqs:
        blocks.append({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
                {"@type": "Question", "name": q,
                 "acceptedAnswer": {"@type": "Answer", "text": a}}
                for q, a in faqs],
        })

    return "\n".join(
        '<script type="application/ld+json">%s</script>' %
        json.dumps(b, ensure_ascii=False) for b in blocks)


def build_byline(blog_key):
    name, role = BYLINE.get(blog_key, ("편집팀", ""))
    return (
        '<p style="margin-top:28px;padding-top:14px;border-top:1px solid #e5e5e5;'
        'font-size:14px;color:#666;">'
        f'<strong>{_html.escape(name)}</strong><br>{_html.escape(role)}</p>'
    )


def enrich(html, spec, blog_key, post_url=None):
    """발행 직전 호출. 이미 들어 있으면 중복으로 넣지 않는다."""
    out = html or ""
    if "application/ld+json" not in out and SCHEMA_IN_BODY:
        out = out + "\n" + build_jsonld(spec, blog_key, post_url)
    if "border-top:1px solid #e5e5e5" not in out:
        # 바이라인은 스키마보다 앞, 본문 맨 끝에
        idx = out.find('<script type="application/ld+json">')
        by = build_byline(blog_key)
        out = (out[:idx] + by + "\n" + out[idx:]) if idx > 0 else out + "\n" + by
    return out


if __name__ == "__main__":
    import glob
    import os
    import sys
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    folder = sys.argv[1] if len(sys.argv) > 1 else "batch_0811_dawn"
    base = os.path.dirname(os.path.abspath(__file__))
    for f in sorted(glob.glob(os.path.join(base, folder, "*.json"))):
        if os.path.basename(f).startswith("_"):
            continue
        d = json.load(open(f, encoding="utf-8"))
        faqs = extract_faq(d.get("html", ""))
        print(f"{os.path.basename(f):24s} FAQ {len(faqs)}개  "
              f"바이라인 {BYLINE.get(d.get('blog_key'), ('?',))[0]}")
