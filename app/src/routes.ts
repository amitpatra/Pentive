import { JSX, lazy } from "solid-js"
import type { RouteDefinition } from "solid-app-router"

import Home from "./pages/home"
import HomeData from "./pages/home.data"
import AboutData from "./pages/about.data"

export interface NavLinkData {
  content: JSX.Element
  href: string
  className: string
  activeClass: string
  end: boolean
}

const defaultNavLink = {
  className: "no-underline hover:underline",
  activeClass: "font-bold",
  end: false,
}

export const navLinks: NavLinkData[] = [
  {
    ...defaultNavLink,
    content: "Home",
    href: "/",
    end: true,
  },
  {
    ...defaultNavLink,
    content: "About",
    href: "/about",
  },
  {
    ...defaultNavLink,
    content: "Error",
    href: "/error",
  },
]

export const routes: RouteDefinition[] = [
  {
    path: "/",
    component: Home,
    data: HomeData,
  },
  {
    path: "/about",
    component: lazy(async () => await import("./pages/about")),
    data: AboutData,
  },
  {
    path: "/testdb",
    component: lazy(async () => await import("./pages/testdb")),
  },
  {
    path: "**",
    component: lazy(async () => await import("./pages/404")),
  },
]
