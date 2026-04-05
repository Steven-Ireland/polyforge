#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "../grammar/semantics.js";
import { evaluate } from "../interpreter/evaluator.js";
import { emitGLB } from "../emit/gltf.js";

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

      console.log(`Writing ${outputPath}...`);
      await emitGLB(meshBuilder.getRoot(), outputPath);

      console.log(`Done! Model written to ${outputPath}`);
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
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
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
