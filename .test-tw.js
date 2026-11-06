const tailwind = require("tailwindcss");

async function run() {
  const compiler = await tailwind.compile(`
    @import "tailwindcss";
    @custom-variant dark (&:where(.dark, .dark *));
  `);
  const css = compiler.build(["dark:text-white", "text-gray-900"]);
  console.log("CSS OUTPUT:\n", css);
}

run();

