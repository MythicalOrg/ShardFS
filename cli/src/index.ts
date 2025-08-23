#!/usr/bin/env node
import { Command } from "commander";
import upload from "./commands/upload";
import download from "./commands/download";
import list from "./commands/list";
import dashboard from "./commands/dashboard";

const program = new Command();

program
  .name("shardfs")
  .description("ShardFS CLI Client - Distributed File Storage System")
  .version("1.0.0");

program
  .command("upload")
  .argument("<filepath>", "Path to the file to upload")
  .action(async (filepath: string) => {
    try {
      await upload(filepath);
    } catch (err) {
      console.error("Upload failed:", err);
    }
  });

program
  .command("download")
  .argument("<filename>", "File name to download")
  .argument("<dest>", "Destination path to save the file")
  .action(async (filename: string, dest: string) => {
    try {
      await download(filename, dest);
    } catch (err) {
      console.error("Download failed:", err);
    }
  });

program
  .command("list")
  .description("List all files stored in ShardFS")
  .action(async () => {
    try {
      await list();
    } catch (err) {
      console.error("List failed:", err);
    }
  });

program
  .command("dashboard")
  .description("Open the ShardFS React dashboard")
  .action(async () => {
    try {
      await dashboard();
    } catch (err) {
      console.error("Dashboard failed:", err);
    }
  });



// Parse args - in short, it helps to process the command line arguments and execute the appropriate command
program.parse(process.argv);
