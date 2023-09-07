/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { buildTree_async, taskCreate_async, taskRead_async, taskUpdate_async, taskDelete_async, getAllChildrenOfNode, deleteBranch } from "./TaskSystemConfigTasks/configTasks.mjs";
import _ from 'lodash';
import { utils } from "../utils.mjs";
import memoize from 'memoizee';

// We have cacheStore_async provided by storage.mjs but experimenting with memoize
// Can invalidate the memoize cache by updating configTreeUpdatedAt
// eslint-disable-next-line no-unused-vars
const m_buildTree_async = memoize(async (configTreeUpdatedAt) => {
  return buildTree_async();
}, { promise: true });

let configTree;
let nodesById;
let configTreeUpdatedAt = Date();

// eslint-disable-next-line no-unused-vars
const TaskSystemConfigTasks_async = async function (wsSendTask, T, fsmHolder, CEPFuncs) {

  if (T("processor.commandArgs.sync")) {utils.logTask(T(), "Ignore sync operations")}
  if (T("processor.commandArgs.sync")) {return null} // Ignore sync operations

  function removeSameProperties(objA, objB) {
    if ((!_.isObject(objA) && _.isObject(objB)) || 
        (_.isObject(objA) && !_.isObject(objB))
    ) {
      return;
    }
    for (const key in objB) {
      if ((!_.isObject(objA[key]) && _.isObject(objB[key])) ||
          (_.isObject(objA[key]) && !_.isObject(objB[key]))
      ) {
        // Do nothing
      } else if (_.isEqual(objA[key], objB[key])) {
        // If the property in objB is the same as that in objA, delete it
        delete objB[key];
      } else if (_.isObject(objB[key]) && _.isObject(objA[key])) {
        // If the property is another object, dive deeper
        removeSameProperties(objA[key], objB[key]);
        // If after removing properties recursively, an object becomes empty, remove it too
        if (_.isEmpty(objB[key])) {
          delete objB[key];
        }
      }
    }
  }

  switch (T("state.current")) {
    case "start": {
      [nodesById, configTree] = await m_buildTree_async(configTreeUpdatedAt);
      T("shared.configTree", configTree);
      T("state.current", "loaded");
      T("command", "update");
      break;
    }
    case "loaded": {
      const action = T("request.action")
      const actionId = T("request.actionId");
      let done = false;
      console.log("action:", action, "id:", actionId);
      if (action === "read") {
        // Could us promise.all to fetch in parallel
        const requestedTask = await taskRead_async(actionId);
        const requestedTaskParent = await taskRead_async(requestedTask?.meta?.parentId);
        const diff = JSON.parse(JSON.stringify(requestedTask));
        removeSameProperties(requestedTaskParent, diff);
        T("response.task", requestedTask);
        T("response.taskDiff", diff);
        done = true;
      } else if (action === "update") {
        await taskUpdate_async(T("request.actionTask"));
        configTreeUpdatedAt = Date();
        [nodesById, configTree] = await m_buildTree_async(configTreeUpdatedAt);
        done = true;
      } else if (action === "delete") {
        // Find all the tasks in the branch
        const children = getAllChildrenOfNode(actionId, nodesById);
        console.log("children", children.length);
        await taskDelete_async(actionId);
        configTree = deleteBranch(actionId, configTree);
        delete nodesById[actionId];
        for (const child of children) {
          if (child === null) {
            continue;
          }
          //console.log("delete child ", child.key);
          await taskDelete_async(child.key);
          delete nodesById[child.key];
        }
        // We do not rebuild the tree because we hav set the child to null annd this needs to be sent
        // The rebuilt tree will not have the child so it would not be deleted
        done = true;
      } else if (action === "create") {
        const newTask = await taskRead_async(actionId);
        const childrenCount = newTask.meta.childrenId ? newTask.meta.childrenId.length : 0;
        const postfix = "new" + childrenCount;
        newTask.meta = newTask.meta || {};
        newTask.meta.childrenId = [];
        newTask.meta.parentId = newTask.id;
        newTask.id += "." + postfix;
        newTask.parentName = newTask.name;
        newTask.name += postfix;
        newTask.config = newTask.config || {};
        newTask.config.label = newTask.config.label || "";
        newTask.config.label += " " + postfix;
        await taskCreate_async(newTask);
        const parentTask = await taskRead_async(actionId);
        parentTask.meta.childrenId = parentTask.meta.childrenId || [];
        parentTask.meta.childrenId.push(newTask.id);
        await taskUpdate_async(parentTask);
        console.log("create ", newTask.id);
        configTreeUpdatedAt = Date();
        [nodesById, configTree] = await m_buildTree_async(configTreeUpdatedAt);
        done = true;
      }
      if (action) {
        if (done) {
          //console.log("nodesById", nodesById[actionId]);
          T("shared.configTree", configTree);
          T("state.current", "actionDone");
          T("command", "update");
        } else {
          // Should deal with errors etc
          T("state.current", "actionDone");
          T("command", "update");
        }
      }
    }
    break;
    default:
      utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
      return null;
  }

  return T();
};

export { TaskSystemConfigTasks_async };
