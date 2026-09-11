# -*- coding: utf-8 -*-
"""문체 검사기 (2026-09-11) — daily_run.py 가 import 해서 쓴다.

브리프마다 "- **문체**: ... `~요`체" 처럼 어조가 정해져 있는데 모델이 이걸 놓치고
글 전체를 다른 어조로 쓰는 일이 있다(2026-09-10 실측에서 확인).
"""
import os
import re

# 실제 발행본 151편을 재 보니 정상 요체 글도 짧고 단정적인 '~다' 문장을
# 20~36% 섞어 쓴다 — 그건 자연스러운 한국어지 위반이 아니다. 그래서
# "어긋난 어조가 과반(50%)일 때"만, 즉 글의 기본 어조가 통째로 뒤집혔을 때만 잡는다.

_TONE_RE = re.compile(r'^\s*[-*]?\s*\**문체\**\s*[:：](.+)$', re.M)


def brief_tone(blog, base):
    """브리프의 '문체' 줄을 읽어 요구 어조를 돌려준다.
    반환: '요' / '습니다' / '혼용' / '다' / None(미지정·파일없음 → 검사 건너뜀)
    """
    try:
        s = open(os.path.join(base, 'briefs', blog + '.md'), encoding='utf-8').read()
    except Exception:
        return None
    m = _TONE_RE.search(s)
    if not m:
        return None
    line = m.group(1)
    yo = ('~요' in line) or ('요체' in line)
    sm = '습니다' in line
    da = ('~다' in line) or ('다체' in line)
    if yo and sm:
        return '혼용'
    if yo:
        return '요'
    if sm:
        return '습니다'
    if da:
        return '다'
    return None


_TONE_TAG = re.compile(r'<[^>]+>')
_TONE_PARA = re.compile(r'<p\b[^>]*>(.*?)</p>', re.S | re.I)
_TONE_YO = re.compile(r'(요|죠|쇼)[.!?…]*$')
_TONE_SM = re.compile(r'(습니다|습니까|ㅂ니다|입니다)[.!?…]*$')
_TONE_DA = re.compile(r'([가-힣])다[.!?…]+$')
_TONE_DAQ = re.compile(r'(는가|은가|을까|ㄹ까|인가)[?]$')


def tone_stats(html):
    """본문 <p> 안 문장의 종결어미를 세어 {'요','습니다','다','기타'} 로 돌려준다."""
    body = ' '.join(_TONE_PARA.findall(html or ''))
    body = _TONE_TAG.sub(' ', body).replace('&nbsp;', ' ')
    out = {'요': 0, '습니다': 0, '다': 0, '기타': 0}
    for sent in re.split(r'(?<=[.!?])\s+', body):
        s = sent.strip()
        if len(s) < 6:
            continue
        if _TONE_SM.search(s):
            out['습니다'] += 1
        elif _TONE_YO.search(s):
            out['요'] += 1
        elif _TONE_DA.search(s) or _TONE_DAQ.search(s):
            out['다'] += 1
        else:
            out['기타'] += 1
    return out


def tone_violation(html, want, min_sents=10, ratio=0.5):
    """요구 어조와 어긋나면 사람이 읽을 사유 문자열, 맞으면 None."""
    if not want:
        return None
    st = tone_stats(html)
    n = st['요'] + st['습니다'] + st['다']
    if n < min_sents:
        return None
    polite = st['요'] + st['습니다']
    if want in ('요', '습니다', '혼용'):
        if st['다'] / n >= ratio:
            return "브리프는 존댓말(%s)인데 '~다' 종결이 %d/%d문장(%d%%)" % (want, st['다'], n, st['다'] * 100 // n)
    elif want == '다':
        if polite / n >= ratio:
            return "브리프는 '~다'체인데 존댓말 종결이 %d/%d문장(%d%%)" % (polite, n, polite * 100 // n)
    return None


_TONE_LABEL = {'요': "'~요'체(해요체) 존댓말로 쓴다", '습니다': "'~습니다'체 존댓말로 쓴다",
               '혼용': "'~습니다'체와 '~요'체 존댓말을 섞어 쓴다", '다': "'~다'체(평서형)로 쓴다"}


def tone_retry_note(want, why):
    return ("\n\n※ 다시 쓰는 이유 — 문체가 브리프와 어긋났다: " + why +
            "\n이 블로그는 " + _TONE_LABEL.get(want, str(want)) + ". "
            "본문 문장의 종결어미를 그 문체로 맞춰 다시 써라(표 안의 항목·출처 표기 줄은 예외). "
            "내용·구조·사실관계는 그대로 두고 어조만 맞춘다.")
