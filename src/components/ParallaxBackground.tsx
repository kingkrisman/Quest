import { useEffect, useRef, useState } from "react";
import { motion, useTransform, useMotionValue } from "motion/react";

export function ParallaxBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const blob1X = useTransform(mouseX, [-1, 1], [-15, 15]);
  const blob1Y = useTransform(mouseY, [-1, 1], [-15, 15]);
  const blob2X = useTransform(mouseX, [-1, 1], [-25, 25]);
  const blob2Y = useTransform(mouseY, [-1, 1], [-25, 25]);
  const blob3X = useTransform(mouseX, [-1, 1], [25, -25]);
  const blob3Y = useTransform(mouseY, [-1, 1], [25, -25]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const { left, top, width, height } = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - left) / width;
      const y = (e.clientY - top) / height;

      mouseX.set(x - 0.5);
      mouseY.set(y - 0.5);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Main gradient blob */}
      <motion.div
        className="absolute w-[600px] h-[600px] blur-[120px] rounded-full pointer-events-none"
        style={{
          backgroundColor: "rgba(218, 119, 86, 0.15)",
          left: "50%",
          top: "50%",
          x: "-50%",
          y: "-50%",
          translateX: blob1X,
          translateY: blob1Y,
        }}
      />

      {/* Secondary accent blob */}
      <motion.div
        className="absolute w-[400px] h-[400px] blur-[100px] rounded-full pointer-events-none"
        style={{
          backgroundColor: "rgba(251, 146, 60, 0.08)",
          right: "-100px",
          bottom: "-100px",
          translateX: blob2X,
          translateY: blob2Y,
        }}
      />

      {/* Tertiary accent blob */}
      <motion.div
        className="absolute w-[500px] h-[500px] blur-[110px] rounded-full pointer-events-none"
        style={{
          backgroundColor: "rgba(251, 146, 60, 0.05)",
          left: "-150px",
          top: "-100px",
          translateX: blob3X,
          translateY: blob3Y,
        }}
      />
    </div>
  );
}
