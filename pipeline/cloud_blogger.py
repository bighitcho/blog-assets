# -*- coding: utf-8 -*-
"""블로거 초안(draft) 발행기 — 반자동 승인 흐름용. google 라이브러리 없이 requests.
  create_draft(blog_id, title, html, labels) -> {id, url, status}
  publish_draft(blog_id, post_id)            -> {id, url, status}
  delete_post(blog_id, post_id)              -> status_code
"""
import json, os, sys, time, requests
_DIR = os.path.dirname(os.path.abspath(__file__))
CA = "/root/.ccr/ca-bundle.crt"
VERIFY = CA if os.path.exists(CA) else True
_TOK = [None]
API = "https://www.googleapis.com/blogger/v3/blogs"

def _at():
    t = json.load(open(os.path.join(_DIR, "token.json"), encoding="utf-8"))
    r = requests.post(t["token_uri"], data={
        "client_id": t["client_id"], "client_secret": t["client_secret"],
        "refresh_token": t["refresh_token"], "grant_type": "refresh_token"},
        verify=VERIFY, timeout=30)
    r.raise_for_status(); return r.json()["access_token"]

def _req(method, url, **kw):
    if _TOK[0] is None: _TOK[0] = _at()
    for i in range(6):
        h = dict(kw.pop("headers", {})); h["Authorization"] = f"Bearer {_TOK[0]}"
        r = requests.request(method, url, headers=h, verify=VERIFY, timeout=60, **kw)
        if r.status_code == 401: _TOK[0] = _at(); continue
        if r.status_code != 429: return r
        time.sleep(15 * (i + 1))
    return r

def create_draft(blog_id, title, html, labels=None):
    body = {"kind": "blogger#post", "title": title, "content": html}
    if labels: body["labels"] = labels
    r = _req("POST", f"{API}/{blog_id}/posts/?isDraft=true", json=body)
    j = r.json() if r.headers.get("content-type","").startswith("application/json") else {}
    return {"code": r.status_code, "id": j.get("id"), "url": j.get("url"),
            "status": j.get("status"), "raw": (r.text[:200] if r.status_code not in (200,201) else "")}

def publish_draft(blog_id, post_id):
    r = _req("POST", f"{API}/{blog_id}/posts/{post_id}/publish")
    j = r.json() if r.headers.get("content-type","").startswith("application/json") else {}
    return {"code": r.status_code, "id": j.get("id"), "url": j.get("url"), "status": j.get("status"),
            "raw": (r.text[:200] if r.status_code not in (200,201) else "")}

def delete_post(blog_id, post_id):
    r = _req("DELETE", f"{API}/{blog_id}/posts/{post_id}")
    return r.status_code

if __name__ == "__main__":
    # 플러밍 테스트: goldnforest 에 초안 생성 → 상태확인 → 삭제
    bid = "2749480142980571635"
    d = create_draft(bid, "[파이프라인 테스트 — 곧 삭제됨]",
                     "<p>클라우드 반자동 발행 플러밍 점검용 임시 초안입니다.</p>", ["테스트"])
    print("create:", d)
    if d.get("id"):
        time.sleep(1)
        print("status is DRAFT (비공개)?:", d.get("status"))
        code = delete_post(bid, d["id"])
        print("delete code:", code)
