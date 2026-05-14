import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

export function ParallaxBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const { left, top, width, height } = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - left) / width;
      const y = (e.clientY - top) / height;

      setMousePosition({
        x: (x - 0.5) * 80,
        y: (y - 0.5) * 80,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Main gradient blob */}
      <motion.div
        className="absolute w-[600px] h-[600px] blur-[120px] rounded-full pointer-events-none"
        style={{
          backgroundColor: "rgba(218, 119, 86, 0.15)",
          left: "50%",
          top: "50%",
        }}
        animate={{
          x: `calc(-50% + ${mousePosition.x * 0.3}px)`,
          y: `calc(-50% + ${mousePosition.y * 0.3}px)`,
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />

      {/* Secondary accent blob */}
      <motion.div
        className="absolute w-[400px] h-[400px] blur-[100px] rounded-full pointer-events-none"
        style={{
          backgroundColor: "rgba(251, 146, 60, 0.08)",
        }}
        animate={{
          right: `calc(-100px + ${mousePosition.x * 0.5}px)`,
          bottom: `calc(-100px + ${mousePosition.y * 0.5}px)`,
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />

      {/* Tertiary accent blob */}
      <motion.div
        className="absolute w-[500px] h-[500px] blur-[110px] rounded-full pointer-events-none"
        style={{
          backgroundColor: "rgba(251, 146, 60, 0.05)",
        }}
        animate={{
          left: `calc(-150px + ${mousePosition.x * -0.4}px)`,
          top: `calc(-100px + ${mousePosition.y * -0.4}px)`,
        }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />

      {/* Animated grid background */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.03]"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id="grid"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 50 0 L 0 0 0 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}
