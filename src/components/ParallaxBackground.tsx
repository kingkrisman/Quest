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
        x: (x - 0.5) * 60,
        y: (y - 0.5) * 60,
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
          x: `-50%`,
          y: `-50%`,
          translateX: mousePosition.x * 0.2,
          translateY: mousePosition.y * 0.2,
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />

      {/* Secondary accent blob */}
      <motion.div
        className="absolute w-[400px] h-[400px] blur-[100px] rounded-full pointer-events-none"
        style={{
          backgroundColor: "rgba(251, 146, 60, 0.08)",
          right: "-100px",
          bottom: "-100px",
        }}
        animate={{
          translateX: mousePosition.x * 0.35,
          translateY: mousePosition.y * 0.35,
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />

      {/* Tertiary accent blob */}
      <motion.div
        className="absolute w-[500px] h-[500px] blur-[110px] rounded-full pointer-events-none"
        style={{
          backgroundColor: "rgba(251, 146, 60, 0.05)",
          left: "-150px",
          top: "-100px",
        }}
        animate={{
          translateX: mousePosition.x * -0.25,
          translateY: mousePosition.y * -0.25,
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}
