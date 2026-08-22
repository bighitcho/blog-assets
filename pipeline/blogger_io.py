# -*- coding: utf-8 -*-
"""Blogger REST 헬퍼 (google 라이브러리 없이 requests). 발행글 조회·본문수정용."""
import json, os, time, requests
CA = "/root/.ccr/ca-bundle.crt"
VERIFY = CA if os.path.exists(CA) else True
_DIR = os.path.dirname(os.path.abspath(__file__))
_TOK = [None]


def _at():
    tok = json.load(open(os.path.join(_DIR, "token.json"), encoding="utf-8"))
    r = requests.post(tok["token_uri"], data={
        "client_id": tok["client_id"], "client_secret": tok["client_secret"],
        "refresh_token": tok["refresh_token"], "grant_type": "refresh_token"},
        verify=VERIFY, timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def _req(method, url, **kw):
    if _TOK[0] is None:
        _TOK[0] = _at()
    for i in range(7):
        h = dict(kw.pop("headers", {})); h["Authorization"] = f"Bearer {_TOK[0]}"
        r = requests.request(method, url, headers=h, verify=VERIFY, timeout=60, **kw)
        if r.status_code == 401:
            _TOK[0] = _at(); continue
        if r.status_code != 429:
            return r
        time.sleep(20 * (i + 1))
    return r


def list_posts(blog_id):
    out, tok = [], None
    while True:
        u = f"https://www.googleapis.com/blogger/v3/blogs/{blog_id}/posts?maxResults=50&fetchBodies=true&status=live"
        if tok:
            u += f"&pageToken={tok}"
        j = _req("GET", u).json()
        out += j.get("items", [])
        tok = j.get("nextPageToken")
        if not tok:
            break
    return out


def get_post(blog_id, post_id):
    return _req("GET", f"https://www.googleapis.com/blogger/v3/blogs/{blog_id}/posts/{post_id}").json()


def update_content(blog_id, post_id, html):
    r = _req("PATCH", f"https://www.googleapis.com/blogger/v3/blogs/{blog_id}/posts/{post_id}",
             json={"content": html})
    return r.status_code, ("ok" if r.status_code in (200, 201) else r.text[:150])
