import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tranquera · gestión de campo",
    short_name: "Tranquera",
    description: "Animales, sanidad y potreros de tu campo, también sin señal.",
    start_url: "/campos",
    display: "standalone",
    background_color: "#f6f3ee",
    theme_color: "#7a4a2a",
    lang: "es",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
