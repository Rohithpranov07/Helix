"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface AnimatedTabsProps {
  tabs?: Tab[];
  defaultTab?: string;
  className?: string;
}

const defaultTabs: Tab[] = [
  {
    id: "tab1",
    label: "Tab 1",
    content: (
      <div className="grid grid-cols-2 gap-4 w-full h-full">
        <img
          src="https://images.unsplash.com/photo-1493552152660-f915ab47ae9d?q=80&w=3087&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Tab 1"
          className="rounded-lg w-full h-60 object-cover mt-0 m-0! shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none"
        />

        <div className="flex flex-col gap-y-2">
          <h2 className="text-2xl font-bold mb-0 text-white mt-0 m-0!">
            Tab 1
          </h2>
          <p className="text-sm text-gray-200 mt-0">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam,
            quos.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "tab2",
    label: "Tab 2",
    content: (
      <div className="grid grid-cols-2 gap-4 w-full h-full">
        <img
          src="https://images.unsplash.com/photo-1506543730435-e2c1d4553a84?q=80&w=2362&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Tab 2"
          className="rounded-lg w-full h-60 object-cover mt-0 m-0! shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none"
        />
        <div className="flex flex-col gap-y-2">
          <h2 className="text-2xl font-bold mb-0 text-white mt-0 m-0!">
            Tab 2
          </h2>
          <p className="text-sm text-gray-200 mt-0">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam,
            quos.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "tab3",
    label: "Tab 3",
    content: (
      <div className="grid grid-cols-2 gap-4 w-full h-full">
        <img
          src="https://images.unsplash.com/photo-1522428938647-2baa7c899f2f?q=80&w=2000&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Tab 3"
          className="rounded-lg w-full h-60 object-cover mt-0 m-0!  shadow-[0_0_20px_rgba(0,0,0,0.2)] border-none"
        />
        <div className="flex flex-col gap-y-2">
          <h2 className="text-2xl font-bold mb-0 text-white mt-0 m-0!">
            Tab 3
          </h2>
          <p className="text-sm text-gray-200 mt-0">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam,
            quos.
          </p>
        </div>
      </div>
    ),
  },
];

const AnimatedTabs = ({
  tabs = defaultTabs,
  defaultTab,
  className,
}: AnimatedTabsProps) => {
  const [activeTab, setActiveTab] = useState<string>(defaultTab || tabs[0]?.id || "");

  if (!tabs?.length) return null;

  return (
    <div className={cn("w-full max-w-lg flex flex-col gap-y-2", className)}>
      <div className="flex gap-2 flex-wrap bg-[#11111198] bg-opacity-50 backdrop-blur-sm p-1.5 rounded-2xl border border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-5 py-2.5 text-sm font-medium rounded-xl text-white outline-none transition-colors",
              activeTab !== tab.id && "hover:bg-white/5"
            )}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="active-tab"
                className="absolute inset-0 bg-[#CCFF00] shadow-[0_0_24px_rgba(204,255,0,0.4)] rounded-xl!"
                transition={{ type: "spring", duration: 0.6 }}
              />
            )}
            <span
              className={cn(
                "relative z-10 transition-colors",
                activeTab === tab.id ? "text-black" : "text-white"
              )}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      <div className="p-7 bg-[#11111198] shadow-[0_0_30px_rgba(0,0,0,0.25)] text-white bg-opacity-50 backdrop-blur-sm rounded-2xl border border-white/10 min-h-80 h-full">
        {tabs.map(
          (tab) =>
            activeTab === tab.id && (
              <motion.div
                key={tab.id}
                initial={{
                  opacity: 0,
                  scale: 0.95,
                  x: -10,
                  filter: "blur(10px)",
                }}
                animate={{ opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95, x: -10, filter: "blur(10px)" }}
                transition={{
                  duration: 0.5,
                  ease: "circInOut",
                  type: "spring",
                }}
              >
                {tab.content}
              </motion.div>
            )
        )}
      </div>
    </div>
  );
};

export { AnimatedTabs };
