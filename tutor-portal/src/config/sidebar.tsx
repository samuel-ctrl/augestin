import { LayoutDashboard, BookOpen, Puzzle, ClipboardCheck, MessageCircleQuestion, Users, History, Settings, Phone, Info } from "lucide-react";
import type { NavItem } from "@shared";

export const sidebarItems: NavItem[] = [
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    path: "/self-study",
    label: "Learn Zone",
    icon: <BookOpen className="w-5 h-5" />,
  },
  {
    path: "/quiz-sets",
    label: "Quizzes",
    icon: <Puzzle className="w-5 h-5" />,
  },
  {
    path: "/test-sets",
    label: "Test Module",
    icon: <ClipboardCheck className="w-5 h-5" />,
  },
  {
    path: "/doubts",
    label: "Doubt Hub",
    icon: <MessageCircleQuestion className="w-5 h-5" />,
  },
  {
    path: "/students",
    label: "Students",
    icon: <Users className="w-5 h-5" />,
  },
  {
    path: "/activity-log",
    label: "Activity Log",
    icon: <History className="w-5 h-5" />,
  },
  {
    path: "/settings/lookups",
    label: "Manage",
    icon: <Settings className="w-5 h-5" />,
  },
  {
    path: "/settings/tutor-contact",
    label: "Tutor Contact",
    icon: <Phone className="w-5 h-5" />,
  },
  {
    path: "/settings/about",
    label: "About",
    icon: <Info className="w-5 h-5" />,
  },
];
