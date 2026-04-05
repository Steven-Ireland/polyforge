#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "../grammar/semantics.js";
import { evaluate } from "../interpreter/evaluator.js";
import { emitGLB } from "../emit/gltf.js";
import { checkConnectivity } from "../analysis/connectivity.js";

function printWarnings(warnings: ReturnType<typeof checkConnectivity>) {
  if (warnings.length === 0) return;
  console.warn(`\n${warnings.length} connectivity warning(s):`);
  for (const w of warnings) {
    const loc = w.loc ? ` (line ${w.loc.line})` : "";
    if (w.minDistance < 0) {
      console.warn(
        `  \u26A0 connect${loc}: group "${w.groupA}" or "${w.groupB}" not found under "${w.parentPath}"`
      );
    } else {
      console.warn(
        `  \u26A0 connect${loc}: "${w.groupA}" and "${w.groupB}" are not touching under "${w.parentPath}" (nearest: ${w.minDistance.toFixed(3)} units)`
      );
    }
  }
  console.warn("");
}

const program = new Command();

program
  .name("polyforge")
  .description("A DSL for creating low-poly 3D models")
  .version("0.1.0");

program
  .command("build")
  .description("Compile a .pf file to .glb")
  .argument("<input>", "Input .pf file")
  .option("-o, --output <path>", "Output .glb file path")
  .action(async (input: string, opts: { output?: string }) => {
    try {
      const inputPath = path.resolve(input);
      const source = fs.readFileSync(inputPath, "utf-8");

      const outputPath =
        opts.output ?? inputPath.replace(/\.pf$/, ".glb");

      console.log(`Parsing ${input}...`);
      const ast = parse(source);

      console.log(`Evaluating model "${ast.name}"...`);
      const meshBuilder = evaluate(ast);

      printWarnings(checkConnectivity(ast, meshBuilder.getRoot()));

      console.log(`Writing ${outputPath}...`);
      await emitGLB(meshBuilder.getRoot(), outputPath);

      console.log(`Done! Model written to ${outputPath}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("build-all")
  .description("Compile all .pf files in a directory to .glb")
  .argument("[dir]", "Directory containing .pf files", "examples")
  .action(async (dir: string) => {
    const dirPath = path.resolve(dir);
    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".pf"));
    if (files.length === 0) {
      console.error(`No .pf files found in ${dirPath}`);
      process.exit(1);
    }
    let failed = 0;
    for (const file of files) {
      const inputPath = path.join(dirPath, file);
      const outputPath = inputPath.replace(/\.pf$/, ".glb");
      try {
        const source = fs.readFileSync(inputPath, "utf-8");
        const ast = parse(source);
        const meshBuilder = evaluate(ast);
        printWarnings(checkConnectivity(ast, meshBuilder.getRoot()));
        await emitGLB(meshBuilder.getRoot(), outputPath);
        console.log(`  ✓ ${file} → ${path.basename(outputPath)}`);
      } catch (err: any) {
        console.error(`  ✗ ${file}: ${err.message}`);
        failed++;
      }
    }
    console.log(`\nBuilt ${files.length - failed}/${files.length} files.`);
    if (failed > 0) process.exit(1);
  });

program
  .command("validate")
  .description("Parse a .pf file and report any errors")
  .argument("<input>", "Input .pf file")
  .action((input: string) => {
    try {
      const source = fs.readFileSync(path.resolve(input), "utf-8");
      const ast = parse(source);
      console.log(`Valid! Model "${ast.name}" with ${ast.body.length} top-level statements.`);

      const meshBuilder = evaluate(ast);
      const warnings = checkConnectivity(ast, meshBuilder.getRoot());
      printWarnings(warnings);
      if (warnings.length === 0) {
        console.log("No connectivity issues detected.");
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
