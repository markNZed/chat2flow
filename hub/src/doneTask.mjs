/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { activeTasksStore_async, activeTaskProcessorsStore_async, instancesStore_async, outputStore_async} from "./storage.mjs";
import startTask_async from "./startTask.mjs";

export async function doneTask_async(task) {
  // Should be an assertion
  if (!task.done && !task.next) {
    throw new Error("Called doneTask_async on a task that is not done");
  }
  const nextTask = task.hub?.commandArgs?.nextTask;
  console.log("Task " + task.id + " done " + task.done + " next " + nextTask);
  instancesStore_async.set(task.instanceId, task);
  let outputs = await outputStore_async.get(task.familyId) || {};
  outputs[task.id] = task.output;
  await outputStore_async.set(task.familyId, outputs); // Wait so available in startTask_async
  // It iś possible that the Processor holds on to the Done task while requesting the next task
  // In this case task.next is set instead of task.done
  if (task.done) {
    // We should send a delete message to all the copies and also delete those (see Meteor protocol)
    // !!!
    activeTasksStore_async.delete(task.instanceId);
    activeTaskProcessorsStore_async.delete(task.instanceId);
  } else if (!nextTask) {
    throw new Error("Called doneTask_async on a task that is not done and has no next task");
  }
  // Fetch from the Task Hub
  if (nextTask) {
    await startTask_async(nextTask, task.userId, false, task.hub["sourceProcessorId"], task?.groupId, task.stackPtr, nextTask, task, task.next);
    // In theory the startTask_async will update activeTasksStore_async and that will send the task to the correct processor(s)
  }
}