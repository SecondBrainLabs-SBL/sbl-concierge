"""Browser Use trial runner. usage: python run.py T1 | T2 | T3T4T5 [--specific]"""
import asyncio, json, os, re, secrets, sys, time, tempfile, pathlib
os.environ["ANONYMIZED_TELEMETRY"] = "false"
from dotenv import load_dotenv
load_dotenv(pathlib.Path(__file__).resolve().parents[2] / ".env")
import httpx
from browser_use import Agent, Browser, Tools, ChatBrowserUse, ActionResult

HERE = pathlib.Path(__file__).parent
import argparse
_ap = argparse.ArgumentParser(); _ap.add_argument("tasks"); _ap.add_argument("--llm", default="openai", choices=["openai", "browser-use"])
_ap.add_argument("--model", default=None)
_ap.add_argument("--variant", default="base", choices=["base", "none", "knowledge", "nudge"])
ARGS = _ap.parse_args()
OUT = HERE / "out" / ("openai" if ARGS.llm == "openai" else "browser-use") / ("" if ARGS.variant == "base" else "variant-" + ARGS.variant)
def make_llm():
    if ARGS.llm == "browser-use": return ChatBrowserUse()
    from browser_use import ChatOpenAI
    return ChatOpenAI(model=ARGS.model or "gpt-5.6-luna", temperature=None, frequency_penalty=None)
KNOW = (HERE / "knowledge.txt").read_text()
ROLE = ("You are SBL's own concierge, showing a prospective customer around sbl.so and the SBL product.\n"
        "Work by yourself, be efficient, and report only what you actually saw on the page.\n\n"
        "SBL KNOWLEDGE:\n" + KNOW)
NUDGE = "\nKeep working until the goal is fully achieved. Never defer work to a later turn; you have many steps available."
SYS = {"base": ROLE, "none": None, "knowledge": KNOW, "nudge": ROLE + NUDGE}[ARGS.variant]
SAFETY = ("\nHARD LIMITS: never launch/run/start a campaign, never connect a LinkedIn account, never enter payment "
          "details or buy anything, never invite people, never message anyone, never import real leads. If a captcha "
          "appears, stop and report it with done(success=false).")
DOMAINS = ["sbl.so", "*.sbl.so", "secondbrainlabs.com", "*.secondbrainlabs.com"] + \
    [d for d in os.environ.get("EXTRA_DOMAINS", "").split(",") if d]

GOAL = {
 "T1": ("A visitor who runs a small lead-gen agency asks which plan fits them. Go to the pricing page of https://sbl.so, work out "
        "the best plan for them, and finish by stating the plan, its price and the exact on-page evidence (quote the page text)."),
 "T1s": ("Open https://sbl.so/pricing/ . Read every plan card. A small lead-gen agency needs multiple client workspaces and a few seats. "
         "Choose the cheapest plan that fits, and finish by stating plan name, monthly price, and quoting the exact on-page text you based it on."),
 "T2": ("Find the customer success story on sbl.so most similar to a small B2B lead-gen agency and open it; report the customer and the headline result."),
 "T2s": ("Start at https://sbl.so . Find the customer stories / case studies / testimonials section (check the nav and footer). Open the story "
         "about an agency or lead-gen company. Report customer name and the headline result number exactly as shown on that page."),
 "T3": ("Create a new SBL free-trial account. Start from https://sbl.so (use the Try For Free / sign up button). Use the create_inbox tool to get a disposable "
        "email address and use it to sign up. Name: CX Test. Company: CX-TEST Trial. Password: use the placeholder <secret>sbl_password</secret>. If email verification "
        "is required, use get_latest_email to fetch the link or code and complete it. If signup only offers Google/LinkedIn sign-in with no email option, stop and report. "
        "Finish when you are logged in (or at the first thing that needs a human), and report what each step was."),
 "T3s": ("Go to https://sbl.so, click Try For Free / Sign up. Call create_inbox, sign up with that email using the email+password option (password placeholder "
         "<secret>sbl_password</secret>), name 'CX Test', company 'CX-TEST Trial'. When asked to verify, call get_latest_email, open the link or type the code. Stop once you are logged in."),
 "T4": ("You are logged in to a new SBL test account (continue in this browser). Complete any onboarding, arrive on the dashboard, and begin creating a first LinkedIn outreach "
        "campaign for 'a lead-gen agency selling appointment setting to B2B SaaS founders'. Go as far as a saved DRAFT and stop before any step that launches, imports real leads, "
        "connects LinkedIn or asks for payment. Report exactly where you stopped and why. If a password is asked use <secret>sbl_password</secret>."),
 "T5s": ("Log in at https://app.secondbrainlabs.com/login with email EMAIL_PLACEHOLDER and password <secret>sbl_password</secret> (use the email+password option; if email verification is requested call get_latest_email). Read-only: open Campaigns, open the campaign 'Qualified Sales Meetings Outreach' (id 8620), look at every tab of that campaign and the left navigation (e.g. Analytics, Stats, Reports) and report where campaign statistics are shown and what they contain. Do not change anything."),
 "T5": ("Read-only, do not change anything: find where campaign statistics/analytics are shown for the draft campaign in this account and report what is there."),
}

tools = Tools()
_mail = {}
API = "https://api.mail.tm"

@tools.action("Create a disposable email inbox (mail.tm). Returns the email address to use for signup.")
async def create_inbox() -> ActionResult:
    async with httpx.AsyncClient(timeout=30) as c:
        dom = (await c.get(f"{API}/domains")).json()["hydra:member"][0]["domain"]
        addr = f"cxtest{secrets.token_hex(4)}@{dom}"; pw = secrets.token_urlsafe(16)
        r = await c.post(f"{API}/accounts", json={"address": addr, "password": pw}); r.raise_for_status()
        tok = (await c.post(f"{API}/token", json={"address": addr, "password": pw})).json()["token"]
    _mail.update(addr=addr, token=tok)
    (OUT / "test-email.txt").write_text(addr)
    return ActionResult(extracted_content=f"Inbox created: {addr}", long_term_memory=f"Test inbox email is {addr}")

@tools.action("Get the latest email in the disposable inbox (subject, text, links). Poll up to 60s for one to arrive.")
async def get_latest_email() -> ActionResult:
    if not _mail: return ActionResult(error="No inbox yet; call create_inbox first")
    h = {"Authorization": f"Bearer {_mail['token']}"}
    async with httpx.AsyncClient(timeout=30) as c:
        for _ in range(12):
            msgs = (await c.get(f"{API}/messages", headers=h)).json().get("hydra:member", [])
            if msgs:
                m = (await c.get(f"{API}/messages/{msgs[0]['id']}", headers=h)).json()
                text = m.get("text") or ""
                links = re.findall(r"https?://[^\s\]\)>\"']+", text + " " + " ".join(m.get("html") or []))
                return ActionResult(extracted_content=f"From: {m['from']}\nSubject: {m['subject']}\nBody:\n{text[:1500]}\nLinks:\n" + "\n".join(dict.fromkeys(links)))
            await asyncio.sleep(5)
    return ActionResult(extracted_content="No email arrived within 60s; try again or resend.")

def password():
    f = OUT / ".pw"
    if not f.exists(): f.write_text(secrets.token_urlsafe(12) + "A1!")
    return f.read_text()

async def run_task(name, browser, maxsteps=40):
    d = OUT / name; d.mkdir(parents=True, exist_ok=True)
    key = name.rstrip("s") if name not in ("T3s",) else "T3"
    agent = Agent(task=GOAL[name].replace("EMAIL_PLACEHOLDER", (OUT / "test-email.txt").read_text() if (OUT / "test-email.txt").exists() else "") + SAFETY, llm=make_llm(), browser=browser, tools=tools,
                  extend_system_message=SYS, sensitive_data={"sbl_password": password()},
                  save_conversation_path=str(d / "conversation"), calculate_cost=True, generate_gif=str(d / "run.gif"))
    t0 = time.time(); err = None
    try: h = await agent.run(max_steps=maxsteps)
    except Exception as e: h = agent.history; err = repr(e)
    dt = time.time() - t0
    h.save_to_file(d / "history.json")
    n = h.number_of_steps()
    cost = None
    try: u = h.usage; cost = u.total_cost if u else None; tok = u.total_tokens if u else None
    except Exception: tok = None
    row = dict(task=name, steps=n, seconds=round(dt, 1), sec_per_step=round(dt / max(n, 1), 1),
               is_done=h.is_done(), agent_success=h.is_successful(), errors=[str(e)[:200] for e in h.errors() if e],
               n_errors=sum(1 for e in h.errors() if e), urls=list(dict.fromkeys(u for u in h.urls() if u)),
               final_result=h.final_result(), cost=cost, tokens=tok, exception=err,
               steps_log=[{"i": i + 1, "goal": (s.model_output.current_state.next_goal if s.model_output and hasattr(s.model_output, "current_state") else None) if s.model_output else None,
                           "actions": [json.dumps(a.model_dump(exclude_none=True))[:160] for a in (s.model_output.action if s.model_output else [])],
                           "results": [(r.error or r.extracted_content or "")[:160] for r in s.result]} for i, s in enumerate(h.history)])
    (d / "result.json").write_text(json.dumps(row, indent=1, default=str))
    print(name, {k: row[k] for k in ("steps", "seconds", "is_done", "agent_success", "n_errors", "cost")}); print("RESULT:", row["final_result"])
    return row

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    names = ARGS.tasks.split(",")
    vid = OUT / ("video-" + ARGS.tasks.replace(",", "_"))
    tmp = tempfile.mkdtemp(prefix="bu-trial-")
    browser = Browser(headless=False, user_data_dir=tmp, allowed_domains=DOMAINS, record_video_dir=str(vid),
                      keep_alive=True, window_size={"width": 1366, "height": 850})
    for n in names:
        await run_task(n, browser)
    await browser.kill()

asyncio.run(main())
