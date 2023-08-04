import { ThemeSelector } from "shared-dom"
import { For, type VoidComponent } from "solid-js"
import { NavLink, useLocation } from "@solidjs/router"
import { type NavLinkData } from "./contracts"

const ends = new Set(["/"])

const Nav: VoidComponent<{ navLinks: NavLinkData[] }> = (props) => {
  const location = useLocation()
  return (
    <nav class="bg-gray-200 text-gray-900 px-4">
      <ul class="flex items-center">
        <For each={props.navLinks}>
          {({ href, name }) => (
            <li class="py-2 px-4">
              <NavLink
                href={href}
                class="no-underline hover:underline"
                activeClass="font-bold"
                end={ends.has(href)}
              >
                {name}
              </NavLink>
            </li>
          )}
        </For>
        <li>
          <ThemeSelector />
        </li>

        <li class="text-sm flex items-center space-x-1 ml-auto">
          <button
            class="relative mx-4
flex p-2.5 rounded-md cursor-pointer items-center justify-center transition text-zinc-700 hover:text-zinc-800 hover:bg-zinc-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 640 512"
              class="h-5"
              fill="currentColor"
            >
              <path d="M389.8 125.2C363.7 88.1 320.7 64 272 64c-77.4 0-140.5 61-143.9 137.5c-.6 13-9 24.4-21.3 28.8C63.2 245.7 32 287.2 32 336c0 61.9 50.1 112 112 112H512c53 0 96-43 96-96c0-36.8-20.7-68.8-51.2-84.9c-13.4-7.1-20-22.5-15.8-37.1c2-6.9 3-14.3 3-22c0-44.2-35.8-80-80-80c-12.3 0-23.9 2.8-34.3 7.7c-14.1 6.7-30.9 2.3-39.9-10.5zM272 32c59.5 0 112.1 29.5 144 74.8C430.5 99.9 446.8 96 464 96c61.9 0 112 50.1 112 112c0 10.7-1.5 21-4.3 30.8C612.3 260.2 640 302.9 640 352c0 70.7-57.3 128-128 128H144C64.5 480 0 415.5 0 336c0-62.8 40.2-116.1 96.2-135.9C100.3 106.6 177.4 32 272 32zM228.7 244.7l80-80c6.2-6.2 16.4-6.2 22.6 0l80 80c6.2 6.2 6.2 16.4 0 22.6s-16.4 6.2-22.6 0L336 214.6V368c0 8.8-7.2 16-16 16s-16-7.2-16-16V214.6l-52.7 52.7c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6z" />
            </svg>
            <div
              // https://stackoverflow.com/a/71440299
              class="absolute border border-black bg-lime-300 flex justify-center items-center"
              style={{
                bottom: "0em",
                right: "-0.5em",
                "min-width": "1.6em",
                height: "1.6em",
                "border-radius": "0.8em",
              }}
              role="status"
            >
              13
            </div>
          </button>
          <span>URL:</span>
          <input
            class="w-75px p-1 bg-white text-sm rounded-lg"
            type="text"
            readOnly
            value={location.pathname}
          />
        </li>
      </ul>
    </nav>
  )
}

export default Nav
