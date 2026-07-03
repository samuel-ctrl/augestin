import { Home, BookOpen, Puzzle, ClipboardCheck, MessageCircleQuestion, UserRound } from "lucide-react";
import type { NavItem } from "@shared";

export const sidebarItems: NavItem[] = [
  {
    path: "/",
    label: "Home",
    icon: <Home className="w-5 h-5" />,
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
    path: "/profile",
    label: "Profile",
    icon: <UserRound className="w-5 h-5" />,
  },
];
