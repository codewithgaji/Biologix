import { motion } from "framer-motion";

export default function FingerprintAnimation() {
  return (
    <div className="relative w-64 h-64 mx-auto">
      {/* Outer glow rings */}
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border border-primary/20"
          style={{ margin: `${i * 16}px` }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}

      {/* Fingerprint SVG */}
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute inset-8 text-primary"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        {/* Concentric arcs mimicking fingerprint */}
        {[18, 24, 30, 36, 42].map((r, i) => (
          <motion.circle
            key={i}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray={`${r * 2} ${r}`}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0.3, 0.8, 0.3] }}
            transition={{
              pathLength: { duration: 1.5, delay: i * 0.2 },
              opacity: { duration: 2, repeat: Infinity, delay: i * 0.15 },
            }}
          />
        ))}
        {/* Center dot */}
        <motion.circle
          cx="50"
          cy="50"
          r="3"
          fill="currentColor"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </motion.svg>

      {/* Scan line */}
      <motion.div
        className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
        animate={{ top: ["20%", "80%", "20%"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
