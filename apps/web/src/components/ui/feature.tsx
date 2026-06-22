import { ShieldCheck, GitPullRequest, FlaskConical } from "lucide-react";
import { motion } from "motion/react";

// Neo-Brutalism palette — matches the Immune System page chrome exactly.
const NEO = { yellow: "#ffe600", blue: "#2f5ef5", pink: "#ff3ea5", green: "#3ddc84", orange: "#ff7a1a", ink: "#0a0a0a" };

function Feature() {
  return (
    <div className="w-full py-16 lg:py-20">
      <div className="container mx-auto">
        <motion.div
          className="neo-card neo-lift grid grid-cols-1 gap-8 items-center lg:grid-cols-2 p-8"
          style={{ background: "#fff" }}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex gap-10 flex-col">
            <div className="flex gap-4 flex-col">
              <div>
                <span
                  className="inline-flex items-center gap-2 px-3 py-1 border-[3px] w-fit"
                  style={{ borderColor: NEO.ink, background: NEO.green, color: NEO.ink, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}
                >
                  <span style={{ width: 7, height: 7, background: NEO.ink, flexShrink: 0 }} />
                  Immune System
                </span>
              </div>
              <div className="flex gap-2 flex-col">
                <h2
                  className="text-3xl lg:text-5xl max-w-xl text-left"
                  style={{ fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.05, color: NEO.ink, textTransform: "uppercase" }}
                >
                  Self-healing security,{" "}
                  <span style={{ color: NEO.blue }}>automated.</span>
                </h2>
                <p className="text-[14px] leading-relaxed max-w-xl text-left font-bold" style={{ color: `${NEO.ink}99` }}>
                  HELIX detects vulnerabilities, tests fixes in a shadow twin, and ships
                  a pull request — all without touching production.
                </p>
              </div>
            </div>
            <div className="grid lg:pl-2 grid-cols-1 sm:grid-cols-3 items-start lg:grid-cols-1 gap-5">
              {[
                {
                  Icon: ShieldCheck,
                  color: NEO.yellow,
                  title: "Zero-touch patching",
                  body: "SQLi, XSS, authBypass, secretLeak, and missingRLS are detected via static analysis and patched automatically.",
                },
                {
                  Icon: FlaskConical,
                  color: NEO.blue,
                  title: "Shadow twin validation",
                  body: "Every patch is proven safe in a disposable shadow clone before any code change reaches your repository.",
                },
                {
                  Icon: GitPullRequest,
                  color: NEO.pink,
                  title: "Permanent antibody memory",
                  body: "Approved patches mint an antibody vector. Future scans recognise the same pattern instantly — no re-analysis needed.",
                },
              ].map(({ Icon, color, title, body }, i) => (
                <motion.div
                  key={title}
                  className="flex flex-row gap-4 items-start"
                  initial={{ opacity: 0, x: -14 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                >
                  <motion.span
                    whileHover={{ rotate: 8, scale: 1.08 }}
                    className="flex items-center justify-center w-8 h-8 shrink-0 border-2"
                    style={{ background: color, borderColor: NEO.ink }}
                  >
                    <Icon className="size-4" style={{ color: NEO.ink }} strokeWidth={2.25} />
                  </motion.span>
                  <div className="flex flex-col gap-1">
                    <p style={{ color: NEO.ink, fontWeight: 800, fontSize: 14 }}>{title}</p>
                    <p className="text-sm font-bold" style={{ color: `${NEO.ink}77` }}>{body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right panel — terminal-style patch preview, neo-brutalist console */}
          <div className="neo-card aspect-square flex flex-col overflow-hidden" style={{ background: NEO.ink, boxShadow: `6px 6px 0px ${NEO.ink}40` }}>
            <div className="flex items-center gap-1.5 px-4 py-3" style={{ borderBottom: `3px solid ${NEO.ink}`, background: "#fff" }}>
              <span className="w-2.5 h-2.5" style={{ background: NEO.pink, border: `2px solid ${NEO.ink}` }} />
              <span className="w-2.5 h-2.5" style={{ background: NEO.yellow, border: `2px solid ${NEO.ink}` }} />
              <span className="w-2.5 h-2.5" style={{ background: NEO.green, border: `2px solid ${NEO.ink}` }} />
              <span className="ml-3 font-mono text-[10px] font-extrabold tracking-widest uppercase" style={{ color: `${NEO.ink}99` }}>
                patch · diff view
              </span>
            </div>
            <div className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-5 space-y-0.5">
              <p style={{ color: "#777" }}>{"// authBypass · routes/admin.ts:14"}</p>
              <p style={{ color: NEO.pink }}>{"- if (user.role === 'admin' || true) {"}</p>
              <p style={{ color: NEO.green }}>{"+ if (user.role === 'admin') {"}</p>
              <p className="mt-2" style={{ color: "#777" }}>{"// secretLeak · config/db.ts:3"}</p>
              <p style={{ color: NEO.pink }}>{"- const uri = 'mongodb://admin:p4ssw0rd@...'"}</p>
              <p style={{ color: NEO.green }}>{"+ const uri = process.env.MONGODB_URI"}</p>
              <p className="mt-2" style={{ color: "#777" }}>{"// SQLi · api/users.ts:22"}</p>
              <p style={{ color: NEO.pink }}>{'- db.query(`SELECT * WHERE id=${req.params.id}`)'}</p>
              <p style={{ color: NEO.green }}>{"+ db.query('SELECT * WHERE id=?', [req.params.id])"}</p>
              <p className="mt-2" style={{ color: "#777" }}>{"// XSS · views/comment.tsx:8"}</p>
              <p style={{ color: NEO.pink }}>{"- <div dangerouslySetInnerHTML={{ __html: body }} />"}</p>
              <p style={{ color: NEO.green }}>{"+ <div>{sanitize(body)}</div>"}</p>
              <div className="mt-4 pt-3 flex items-center gap-2" style={{ borderTop: `2px solid ${NEO.ink}80` }}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: NEO.green }} />
                  <span className="relative inline-flex h-2 w-2" style={{ background: NEO.green, border: `1px solid ${NEO.ink}` }} />
                </span>
                <span className="tracking-wider text-[10px] font-extrabold uppercase" style={{ color: NEO.green }}>
                  shadow proof · verdict: promote
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export { Feature };
