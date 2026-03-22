import { createElement } from "react";
import type { NavItem } from "@shared";

const StudentsIcon = () =>
  createElement(
    "svg",
    { className: "w-5 h-5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 },
    createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      d: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0112.714 0l.047.28zm-9.39-9.653a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zm8.25-3.375a2.625 2.625 0 115.25 0 2.625 2.625 0 01-5.25 0z",
    })
  );

export const sidebarItems: NavItem[] = [
  {
    path: "/self-study",
    label: "Self-Study",
    icon: "📚",
  },
  {
    path: "/students",
    label: "Students",
    icon: createElement(StudentsIcon),
  },
];
