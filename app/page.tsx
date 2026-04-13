"use client";

import { Heading, Subheading } from "@/app/components/heading";
import { Link } from "@/app/components/link";
import { ClassesIcon, HomeIcon, StudentsIcon, TeachersIcon } from "@/app/components/main-nav-icons";
import {
  Navbar,
  NavbarDivider,
  NavbarItem,
  NavbarLabel,
  NavbarSection,
} from "@/app/components/navbar";
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from "@/app/components/sidebar";
import { SidebarLayout } from "@/app/components/sidebar-layout";
import { Text } from "@/app/components/text";
import { usePathname } from "next/navigation";

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const directoryLinks = [
  {
    href: "/students",
    title: "Students",
    description: "Search and manage the student roster, grades, and class sign-ups.",
    icon: StudentsIcon,
    accent: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
  },
  {
    href: "/teachers",
    title: "Teachers",
    description: "View staff profiles, contact details, and the classes each teacher leads.",
    icon: TeachersIcon,
    accent: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
  },
  {
    href: "/classes",
    title: "Classes",
    description: "Browse the catalog, see who teaches each class, and who is enrolled.",
    icon: ClassesIcon,
    accent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  },
] as const;

export default function Home() {
  const pathname = usePathname();

  const sidebar = (
    <Sidebar className="bg-white lg:rounded-lg lg:shadow-xs lg:ring-1 lg:ring-zinc-950/5 dark:bg-zinc-900 dark:lg:ring-white/10">
      <SidebarHeader>
        <SidebarSection>
          <SidebarHeading>School</SidebarHeading>
          <SidebarItem href="/" current={pathname === "/"}>
            <HomeIcon />
            <SidebarLabel>Home</SidebarLabel>
          </SidebarItem>
        </SidebarSection>
      </SidebarHeader>
      <SidebarBody>
        <SidebarSection>
          <SidebarHeading>Directory</SidebarHeading>
          <SidebarItem href="/students" current={pathname === "/students" || pathname.startsWith("/students/")}>
            <StudentsIcon />
            <SidebarLabel>Students</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/teachers" current={pathname === "/teachers" || pathname.startsWith("/teachers/")}>
            <TeachersIcon />
            <SidebarLabel>Teachers</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/classes" current={pathname === "/classes" || pathname.startsWith("/classes/")}>
            <ClassesIcon />
            <SidebarLabel>Classes</SidebarLabel>
          </SidebarItem>
        </SidebarSection>
      </SidebarBody>
    </Sidebar>
  );

  const navbar = (
    <Navbar>
      <NavbarSection className="min-w-0">
        <NavbarLabel className="font-semibold text-zinc-950 dark:text-white">Overview</NavbarLabel>
      </NavbarSection>
      <NavbarDivider className="max-lg:hidden" />
      <NavbarSection className="max-lg:hidden">
        <NavbarItem href="/" current>
          Home
        </NavbarItem>
      </NavbarSection>
    </Navbar>
  );

  return (
    <SidebarLayout navbar={navbar} sidebar={sidebar}>
      <div className="mx-auto w-full max-w-5xl space-y-10 pb-2 [--gutter:--spacing(6)]">
        <section
          className="relative overflow-hidden rounded-2xl border border-zinc-950/10 bg-gradient-to-br from-white via-zinc-50/90 to-indigo-50/40 shadow-xs dark:border-white/10 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/30"
          aria-labelledby="home-intro-heading"
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-indigo-400/10 blur-3xl dark:bg-indigo-400/5"
            aria-hidden
          />
          <div className="relative max-w-2xl p-6 sm:p-10">
            <p className="text-sm font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
              School directory
            </p>
            <Heading id="home-intro-heading" className="mt-2 text-balance sm:text-3xl/10">
              Everything in one place
            </Heading>
            <Text className="mt-4 max-w-xl text-pretty text-base text-zinc-600 dark:text-zinc-400">
              Jump to students, teachers, or classes—same navigation everywhere, tuned for quick lookups and day-to-day
              admin work.
            </Text>
          </div>
        </section>

        <section aria-labelledby="home-directory-heading">
          <Subheading id="home-directory-heading" level={2} className="text-zinc-950 dark:text-white">
            Open a directory
          </Subheading>
          <Text className="mt-1 max-w-xl">
            Pick a list to search, filter, and open individual profiles.
          </Text>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {directoryLinks.map(({ href, title, description, icon: Icon, accent }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group relative flex h-full flex-col rounded-2xl border border-zinc-950/10 bg-white shadow-xs transition hover:border-zinc-950/20 hover:shadow-md focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-white/10 dark:bg-zinc-900/80 dark:hover:border-white/20 dark:focus-visible:ring-offset-zinc-900"
                >
                  <div className="flex items-start justify-between gap-3 px-5 pt-5">
                    <span
                      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${accent}`}
                    >
                      <Icon />
                    </span>
                    <ChevronIcon className="size-5 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300" />
                  </div>
                  <span className="mt-4 block px-5 font-semibold text-zinc-950 dark:text-white">{title}</span>
                  <span className="mt-1.5 block px-5 pb-5 text-sm/6 text-zinc-500 dark:text-zinc-400">{description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </SidebarLayout>
  );
}
