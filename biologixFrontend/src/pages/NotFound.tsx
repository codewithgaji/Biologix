import { useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── shard clip paths (same as Landing) ──────────────────────────────────────
const SHARD_CLIP = `polygon(
  8% 0%, 94% 2%, 100% 12%, 98% 88%,
  92% 100%, 6% 98%, 0% 86%, 2% 14%
)`;
const SHARD_CLIP_2 = `polygon(
  4% 6%, 88% 0%, 100% 10%, 96% 92%,
  88% 100%, 10% 96%, 0% 82%, 2% 8%
)`;
const SHARD_GLOW_CLIP = `polygon(
  6% 2%, 96% 0%, 100% 8%, 99% 90%,
  94% 100%, 4% 99%, 0% 88%, 1% 10%
)`;

// ─── founders data ────────────────────────────────────────────────────────────
const founders = [
  {
    name: "Founder One",
    role: "Co-Founder",
    imageSrc: undefined as string | undefined,
  },
  {
    name: "Founder Two",
    role: "Co-Founder",
    imageSrc: undefined as string | undefined,
  },
];

// ─── animated text ────────────────────────────────────────────────────────────
const lines = [
  { text: "404", big: true },
  { text: "Well... this is awkward." },
  { text: "You wandered somewhere that doesn't exist." },
  { text: "Even our founders can't find this page." },
];

// ─── shard frame (compact version for 404) ───────────────────────────────────
function ShardFrame404({
  imageSrc,
  name,
  delay,
  flip,
}: {
  imageSrc?: string;
  name: string;
  delay: number;
  flip?: boolean;
}) {
  return (
    <motion.div
      className="relative w-44 h-52 md:w-52 md:h-60 flex-shrink-0"
      initial={{ opacity: 0, y: 60, rotate: flip ? 6 : -6 }}
      animate={{ opacity: 1, y: 0, rotate: flip ? 3 : -3 }}
      transition={{ delay, duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Glow */}
      <motion.div
        className="absolute inset-[-6px]"
        style={{
          clipPath: SHARD_GLOW_CLIP,
          background: "linear-gradient(135deg, rgba(6,182,212,0.35), rgba(59,130,246,0.2), rgba(6,182,212,0.1))",
        }}
        animate={{ opacity: [0.4, 0.9, 0.4] }}
        transition={{ duration: 3 + delay, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Border */}
      <div
        className="absolute inset-[-2px]"
        style={{
          clipPath: SHARD_CLIP,
          background: "linear-gradient(135deg, #06b6d4, #3b82f6, #06b6d4)",
        }}
      />

      {/* Glare */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ clipPath: SHARD_CLIP }}
      >
        <div
          className="absolute top-0 left-0 w-1/3 h-full opacity-20"
          style={{ background: "linear-gradient(120deg, rgba(255,255,255,0.6) 0%, transparent 100%)" }}
        />
      </div>

      {/* Image or placeholder */}
      <div className="absolute inset-[1px] overflow-hidden" style={{ clipPath: SHARD_CLIP_2 }}>
        {imageSrc ? (
          <img src={imageSrc} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-2"
            style={{ background: "linear-gradient(160deg, #0f1f35 0%, #0a1628 50%, #0d1f3a 100%)" }}
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity, delay }}
            >
              <Fingerprint className="text-cyan-400/50" size={40} />
            </motion.div>
            <p className="text-cyan-400/30 text-[10px] font-mono tracking-widest uppercase">Photo</p>
          </div>
        )}
      </div>

      {/* Floating name tag */}
      <motion.div
        className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.5 }}
      >
        <p className="text-[10px] font-mono tracking-widest text-cyan-400/50 uppercase text-center">{name}</p>
      </motion.div>

      {/* Corner shards */}
      <div
        className="absolute -bottom-1 -right-1 w-6 h-6 opacity-50"
        style={{
          clipPath: "polygon(100% 0%, 100% 100%, 0% 100%)",
          background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
        }}
      />
      <div
        className="absolute -top-1 -left-1 w-5 h-5 opacity-35"
        style={{
          clipPath: "polygon(0% 0%, 100% 0%, 0% 100%)",
          background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
        }}
      />
    </motion.div>
  );
}

// ─── floating fingerprint bg ──────────────────────────────────────────────────
function FpBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: `${8 + i * 20}%`, top: `${15 + (i % 3) * 28}%` }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 25 + i * 5, repeat: Infinity, ease: "linear" }}
        >
          <Fingerprint size={100 + i * 15} className="text-cyan-400" />
        </motion.div>
      ))}
    </div>
  );
}

// ─── animated word reveal ─────────────────────────────────────────────────────
function WordReveal({ text, big, delay }: { text: string; big?: boolean; delay: number }) {
  const words = text.split(" ");
  return (
    <div className={`flex flex-wrap justify-center gap-x-2 gap-y-1 ${big ? "mb-2" : "mb-1"}`}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: delay + i * 0.06, duration: 0.5, ease: "easeOut" }}
          className={
            big
              ? "text-7xl md:text-9xl font-black"
              : "text-base md:text-lg font-light"
          }
          style={
            big
              ? {
                  fontFamily: "'Syne', sans-serif",
                  background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  lineHeight: 1,
                }
              : {
                  fontFamily: "'DM Sans', sans-serif",
                  color: "rgba(186,230,253,0.6)",
                }
          }
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
}

// ─── glitch effect on 404 ─────────────────────────────────────────────────────
function GlitchText() {
  return (
    <div className="relative select-none mb-6">
      {/* Ghost layers */}
      <motion.div
        className="absolute inset-0 flex flex-wrap justify-center"
        animate={{ x: [-2, 2, -2], opacity: [0, 0.4, 0] }}
        transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 3 }}
      >
        <span
          className="text-7xl md:text-9xl font-black"
          style={{
            fontFamily: "'Syne', sans-serif",
            color: "#06b6d4",
            opacity: 0.5,
          }}
        >
          404
        </span>
      </motion.div>
      <motion.div
        className="absolute inset-0 flex flex-wrap justify-center"
        animate={{ x: [2, -2, 2], opacity: [0, 0.3, 0] }}
        transition={{ duration: 0.15, repeat: Infinity, repeatDelay: 3, delay: 0.05 }}
      >
        <span
          className="text-7xl md:text-9xl font-black"
          style={{
            fontFamily: "'Syne', sans-serif",
            color: "#ef4444",
            opacity: 0.4,
          }}
        >
          404
        </span>
      </motion.div>

      <motion.span
        className="relative text-7xl md:text-9xl font-black block text-center"
        style={{
          fontFamily: "'Syne', sans-serif",
          background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          lineHeight: 1,
        }}
        initial={{ opacity: 0, scale: 1.3 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        404
      </motion.span>
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────
const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
      `}</style>

      <div
        className="min-h-screen relative flex flex-col items-center justify-center px-6 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #060d1a 0%, #091525 40%, #060e1c 100%)" }}
      >
        <FpBg />

        {/* Glow orbs */}
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)" }}
        />

        {/* Scanlines */}
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.02]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.3) 2px, rgba(6,182,212,0.3) 3px)",
          }}
        />

        {/* Nav logo */}
        <motion.div
          className="absolute top-6 left-6 flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Fingerprint className="h-6 w-6 text-cyan-400" />
          <span
            className="text-lg font-black"
            style={{
              fontFamily: "'Syne', sans-serif",
              background: "linear-gradient(135deg, #f0f9ff, #06b6d4)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            BioLogix
          </span>
        </motion.div>

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl w-full">

          {/* Founders — float above the text */}
          <div className="flex items-end justify-center gap-8 md:gap-16 mb-12 mt-4">
            <ShardFrame404
              imageSrc={founders[0].imageSrc}
              name={founders[0].name}
              delay={0.2}
              flip={false}
            />
            <ShardFrame404
              imageSrc={founders[1].imageSrc}
              name={founders[1].name}
              delay={0.4}
              flip={true}
            />
          </div>

          {/* Glitch 404 */}
          <GlitchText />

          {/* Message lines */}
          <div className="space-y-1 mb-3">
            <WordReveal text="Well... this is awkward." delay={0.6} />
            <WordReveal text="You wandered somewhere that doesn't exist." delay={0.8} />
            <WordReveal text="Even our founders can't find this page." delay={1.1} />
          </div>

          {/* Path display */}
          <motion.div
            className="mb-10 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            <span
              className="text-xs font-mono px-4 py-2 rounded-lg"
              style={{
                background: "rgba(6,182,212,0.08)",
                border: "1px solid rgba(6,182,212,0.15)",
                color: "rgba(6,182,212,0.5)",
              }}
            >
              {location.pathname}
            </span>
            <p
              className="text-xs mt-2 font-mono"
              style={{ color: "rgba(186,230,253,0.25)" }}
            >
              ← this route does not exist
            </p>
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            className="flex flex-wrap gap-4 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.8, duration: 0.5 }}
          >
            <Link to="/">
              <Button
                size="lg"
                className="font-semibold px-8 gap-2 text-base"
                style={{
                  background: "linear-gradient(135deg, #0891b2, #3b82f6)",
                  border: "none",
                  color: "white",
                  boxShadow: "0 0 30px rgba(6,182,212,0.25)",
                }}
              >
                <Home className="h-4 w-4" />
                Back to Home
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="font-semibold px-8 gap-2 text-base"
              style={{
                borderColor: "rgba(6,182,212,0.25)",
                color: "#67e8f9",
                background: "transparent",
              }}
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </motion.div>
        </div>

        {/* Bottom fingerprint */}
        <motion.div
          className="absolute bottom-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.06 }}
          transition={{ delay: 2 }}
        >
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          >
            <Fingerprint size={180} className="text-cyan-400" />
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};

export default NotFound;