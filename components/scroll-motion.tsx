"use client";

import {
  motion,
  useInView,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const MotionContext = createContext({ enabled: false, rich: false });

export function ScrollExperience({
  children,
  preference,
}: {
  children: ReactNode;
  preference: boolean;
}) {
  const [environment, setEnvironment] = useState({
    reduced: true,
    desktop: false,
  });
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia(
      "(min-width: 1001px) and (pointer: fine)",
    );
    const update = () =>
      setEnvironment({ reduced: reduced.matches, desktop: desktop.matches });
    update();
    reduced.addEventListener("change", update);
    desktop.addEventListener("change", update);
    return () => {
      reduced.removeEventListener("change", update);
      desktop.removeEventListener("change", update);
    };
  }, []);
  const enabled = preference && !environment.reduced;
  return (
    <MotionContext.Provider
      value={{ enabled, rich: enabled && environment.desktop }}
    >
      <div className="scroll-experience" data-motion={enabled ? "on" : "off"}>
        {children}
      </div>
    </MotionContext.Provider>
  );
}

export function ScrollProgress() {
  const { enabled } = useContext(MotionContext);
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      aria-hidden="true"
      className="scroll-progress"
      style={{ scaleX: enabled ? scrollYProgress : 0 }}
    />
  );
}

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { enabled, rich } = useContext(MotionContext);
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, amount: 0.12 });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={
        enabled && !visible
          ? { opacity: 0, y: rich ? 26 : 10, scale: rich ? 0.985 : 1 }
          : { opacity: 1, y: 0, scale: 1 }
      }
      transition={{
        duration: enabled ? 0.6 : 0,
        delay: enabled ? delay : 0,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

export function HeroScene({
  art,
  children,
}: {
  art: ReactNode;
  children: ReactNode;
}) {
  const { rich } = useContext(MotionContext);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const artY = useTransform(progress, [0, 1], [0, 110]);
  const scale = useTransform(progress, [0, 1], [1, 1.08]);
  const contentY = useTransform(progress, [0, 1], [0, 45]);
  const opacity = useTransform(progress, [0, 0.8, 1], [1, 0.8, 0.4]);
  return (
    <section className="hero" id="inicio" ref={ref}>
      <motion.div
        className="hero-art"
        style={{ y: rich ? artY : 0, scale: rich ? scale : 1 }}
      >
        {art}
      </motion.div>
      <motion.div
        className="hero-foreground"
        style={{ y: rich ? contentY : 0, opacity: rich ? opacity : 1 }}
      >
        {children}
      </motion.div>
    </section>
  );
}

export function DepthLayer({
  children,
  className,
  distance = 35,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const { rich } = useContext(MotionContext);
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  return (
    <motion.div ref={ref} className={className} style={{ y: rich ? y : 0 }}>
      {children}
    </motion.div>
  );
}

export function useActiveSection() {
  const [active, setActive] = useState("inicio");
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>(
        "main > section[id], main > div > section[id]",
      ),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (entering[0]) setActive(entering[0].target.id);
      },
      { rootMargin: "-15% 0px -55% 0px", threshold: 0 },
    );
    sections.forEach((section) => {
      observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);
  return active;
}

export function TechnologyBadges({ labels }: { labels: readonly string[] }) {
  return (
    <ul className="tags technology-badges" aria-label="Tecnologias">
      {labels.map((label, index) => (
        <li key={label}>
          <Reveal delay={index * 0.06}>{label}</Reveal>
        </li>
      ))}
    </ul>
  );
}
