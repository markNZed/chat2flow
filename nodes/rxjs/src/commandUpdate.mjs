/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { getActiveTask_async } from "./storage.mjs";
import { utils } from "./utils.mjs";
import { NODE } from "../config.mjs";
import { taskLock } from './shared/taskLock.mjs';

export async function commandUpdate_async(wsSendTask, task) { 
  utils.logTask(task, "commandUpdate_async instanceId:", task.instanceId, "commandArgs:", task.commandArgs, "commandDescription:", task.commandDescription);
  //utils.logTask(task, "commandUpdate_async sync node", lastTask.node);
  let mergedTask = {}
  // Deep copy task.node to avoif changes to task that was passed in
  const commandArgs = task.commandArgs || {};
  const commandDescription = task.commandDescription || "";
  const sync = commandArgs.sync;
  const syncTask = commandArgs.syncTask;
  const syncInstanceId = commandArgs.instanceId
  if (sync) {
    if (!syncInstanceId) {
      console.error("Missing syncInstanceId", task);
      throw new Error("Missing syncInstanceId");
    }
    await taskLock(syncInstanceId, "commandUpdate_async " + commandDescription);
    mergedTask["instanceId"] = syncInstanceId;
    mergedTask["command"] = "update";
    mergedTask["commandArgs"] = {
      syncTask: syncTask,
      sync: true,
      lockBypass: true, // Could enforce this on the hub when sync is true
    };
    mergedTask["meta"] = {};
    mergedTask["node"] = {};
    mergedTask.node["coprocessingDone"] = true; // So sync is not coprocessed again, it can still be logged
  } else {
    utils.logTask(task, "commandUpdate_async requesting lock for update", task.instanceId);
    await taskLock(task.instanceId, "commandUpdate_async " + commandDescription);
    const lastTask = await getActiveTask_async(task.instanceId);
    if (!lastTask) {
      throw new Error("No lastTask found for " + task.instanceId);
    }
    mergedTask = utils.deepMerge(lastTask, task);
    mergedTask.node = JSON.parse(JSON.stringify(task.node));
    mergedTask.node["coprocessingDone"] = false;
  } 
  mergedTask["command"] = "update";
  // Because this is a fresh command sent from the coprocessor not part of the coprocessing pipeline
  mergedTask.node["coprocessing"] = false;
  // Because it is this node that is the initiator
  mergedTask.node["initiatingProcessorId"] = NODE.id; //"coprocessor";
  try {
    //utils.logTask(task, "commandUpdate_async mergedTask.state", mergedTask.state);
    mergedTask.meta["prevMessageId"] = mergedTask.meta.messageId;
    mergedTask.meta["messageId"] = utils.nanoid8();
    utils.logTask(task, "Creating new messageId", mergedTask.meta.messageId, "prevMessageId", mergedTask.meta.prevMessageId);
    //utils.logTask(task, "wsSendTask");
    wsSendTask(mergedTask);
  } catch (error) {
    console.error(`Command ${mergedTask.command} failed to fetch ${error}`);
  }
}
