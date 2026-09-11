# -*- coding: utf-8 -*-
"""daily_run.py 에 문체 검사기를 붙이는 1회용 패치 (2026-09-11).

쓰는 법: 이 파일과 tone_check.py 를 daily_run.py 와 같은 폴더에 두고
    python apply_tone_patch.py
이미 패치돼 있으면 아무것도 하지 않는다(여러 번 돌려도 안전).
원본은 daily_run.py.bak-20260911-tonecheck 로 남는다.
"""
import io
import os
import py_compile
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, "daily_run.py")
BACKUP = TARGET + ".bak-20260911-tonecheck"

IMP_ANCHOR = """
from title_ending import classify_ending  # noqa: E402
"""[1:-1]

IMP_NEW = """
from title_ending import classify_ending  # noqa: E402
from tone_check import brief_tone, tone_stats, tone_violation, tone_retry_note  # noqa: E402
"""[1:-1]

B_OLD = """
    for attempt in range(3):
        out, st = claude_p_patient(prompt, cfg["write_model"], "Read,Write,Glob,WebSearch,WebFetch",
                                    cfg.get("write_timeout", 900), label=f"[{stem}] 원고", cfg=cfg)
        if st == "spend":
            log(f"[{stem}] 사용한도 미회복 — 원고 포기")
            break
        if os.path.isfile(path):
            # 2026-09-01: 파일만 있으면 성공으로 보고 빠져나가던 탓에, JSON 이 깨지면
            # 재시도 없이 그대로 유실됐다(tera-company 도쿄게임쇼 편 실사고).
            # 이제 파싱까지 확인하고, 깨졌으면 격리한 뒤 다시 쓰게 한다.
            try:
                json.load(open(path, encoding="utf-8"))
                break
            except Exception as e:
                try:
                    os.replace(path, os.path.join(
                        out_dir, f"_BROKEN_{attempt+1}_" + os.path.basename(path)))
                except Exception:
                    pass
                log(f"[{stem}] 원고 JSON 깨짐({str(e)[:60]}) — 재시도 {attempt+1}")
                continue
        log(f"[{stem}] 원고 파일 없음({st}) — 재시도 {attempt+1}")
    if not os.path.isfile(path):
        return stem, "fail"
"""[1:-1]

B_NEW = """
    base_prompt = prompt
    want_tone = brief_tone(blog, BASE) if cfg.get("tone_check", True) else None
    tries = 3
    for attempt in range(tries):
        out, st = claude_p_patient(prompt, cfg["write_model"], "Read,Write,Glob,WebSearch,WebFetch",
                                    cfg.get("write_timeout", 900), label=f"[{stem}] 원고", cfg=cfg)
        if st == "spend":
            log(f"[{stem}] 사용한도 미회복 — 원고 포기")
            break
        if os.path.isfile(path):
            # 2026-09-01: 파일만 있으면 성공으로 보고 빠져나가던 탓에, JSON 이 깨지면
            # 재시도 없이 그대로 유실됐다(tera-company 도쿄게임쇼 편 실사고).
            # 이제 파싱까지 확인하고, 깨졌으면 격리한 뒤 다시 쓰게 한다.
            try:
                _d = json.load(open(path, encoding="utf-8"))
            except Exception as e:
                try:
                    os.replace(path, os.path.join(
                        out_dir, f"_BROKEN_{attempt+1}_" + os.path.basename(path)))
                except Exception:
                    pass
                log(f"[{stem}] 원고 JSON 깨짐({str(e)[:60]}) — 재시도 {attempt+1}")
                continue
            # 2026-09-11 문체 검사: 글 전체 어조가 브리프와 뒤집혔으면 다시 쓰게 한다.
            # 단 발행을 막지는 않는다 — 문체 하나 때문에 그날 그 블로그를 0편으로
            # 비우는 건 애드센스 관점에서 훨씬 나쁘다(2026-09-09 tera-company 판정).
            bad = tone_violation(_d.get("html", ""), want_tone)
            if bad and attempt + 1 < tries:
                try:
                    os.replace(path, f"{path}.tone{attempt+1}")   # 재시도가 실패하면 되살릴 보관본
                except Exception:
                    pass
                prompt = base_prompt + tone_retry_note(want_tone, bad)
                log(f"[{stem}] 문체 어긋남 — {bad} → 재시도 {attempt+1}")
                continue
            if bad:
                log(f"[{stem}] ⚠ 문체 어긋남 유지 — {bad} (발행은 그대로 진행)")
            break
        log(f"[{stem}] 원고 파일 없음({st}) — 재시도 {attempt+1}")
    if not os.path.isfile(path):
        # 문체 때문에 치워 둔 원고가 있으면 되살린다 — 어조 하나로 발행을 날리지 않는다
        for k in range(tries, 0, -1):
            keep = f"{path}.tone{k}"
            if os.path.isfile(keep):
                try:
                    os.replace(keep, path)
                    log(f"[{stem}] 재시도 실패 — 문체 어긋난 원고로 되돌려 발행 진행")
                except Exception:
                    pass
                break
    if not os.path.isfile(path):
        return stem, "fail"
"""[1:-1]


def die(msg):
    print("[실패] " + msg)
    print("       daily_run.py 는 건드리지 않았다.")
    sys.exit(1)


def main():
    if not os.path.isfile(TARGET):
        die("daily_run.py 가 이 폴더에 없다: " + HERE)
    if not os.path.isfile(os.path.join(HERE, "tone_check.py")):
        die("tone_check.py 가 이 폴더에 없다. 같이 받아서 넣어라.")
    src = io.open(TARGET, encoding="utf-8", newline="").read()

    if "tone_check import" in src and "want_tone" in src:
        print("[건너뜀] 이미 패치돼 있다. 바꿀 게 없다.")
        return

    if src.count(IMP_ANCHOR) != 1:
        die("import 자리표를 %d 개 찾았다(1개여야 한다)." % src.count(IMP_ANCHOR))
    if src.count(B_OLD) != 1:
        die("원고 재시도 루프를 %d 개 찾았다(1개여야 한다). daily_run.py 가 예상과 다르다." % src.count(B_OLD))

    out = src.replace(IMP_ANCHOR, IMP_NEW, 1).replace(B_OLD, B_NEW, 1)

    io.open(BACKUP, "w", encoding="utf-8", newline="").write(src)
    io.open(TARGET, "w", encoding="utf-8", newline="").write(out)

    try:
        py_compile.compile(TARGET, doraise=True)
        py_compile.compile(os.path.join(HERE, "tone_check.py"), doraise=True)
    except Exception as e:
        io.open(TARGET, "w", encoding="utf-8", newline="").write(src)
        die("문법 오류로 되돌렸다: " + str(e))

    sys.path.insert(0, HERE)
    import tone_check
    yo = "".join("<p>이건 %d번째 문장이라 이렇게 정리해요.</p>" % i for i in range(14))
    da = "".join("<p>이건 %d번째 문장이라 이렇게 정리한다.</p>" % i for i in range(14))
    if tone_check.tone_violation(yo, "요") is not None:
        die("자체검사 실패 — 정상 요체 글을 위반으로 잡는다(오탐).")
    if tone_check.tone_violation(da, "요") is None:
        die("자체검사 실패 — 다체 글을 못 잡는다.")
    if tone_check.tone_violation(da, None) is not None:
        die("자체검사 실패 — 문체 미지정인데 검사를 한다.")

    print("[완료] daily_run.py 에 문체 검사기를 붙였다.")
    print("       원본 백업: " + os.path.basename(BACKUP))
    print("       자체검사 통과(정상 요체 통과 / 다체 검출 / 문체 미지정 건너뜀).")
    print("       다음 배치부터 적용된다. 끄려면 daily_config.json 의 tone_check 를 false 로.")


main()
