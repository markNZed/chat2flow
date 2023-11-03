/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/
import { accessDB, usersStore_async, groupsStore_async } from "#src/storage";
import bcrypt from 'bcrypt';
import { utils } from '#src/utils';
import { writeFile, readFile } from 'fs/promises';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// eslint-disable-next-line no-unused-vars
const TaskUsers_async = async function (wsSendTask, T, FSMHolder) {

    if (T("node.commandArgs.sync")) {return null} // Ignore sync operations

    const hashPassword = async (password, saltRounds = 10) => {
      const salt = await bcrypt.genSalt(saltRounds);
      const hash = await bcrypt.hash(password, salt);
      return hash;
    };

    const updateRuntimeUsers_async = async (user) => {
      await usersStore_async.set(user.id, user);
      // Read the config if it exists
      // Modify with user
      // Write the config
      const runtimeDir = join(__dirname, '../../../../../hub/db/config/runtime');
      let path = join(runtimeDir, 'users.json');
      //console.log("updateRuntimeUsers_async", __dirname, path, user);
      let runtimeData = {};
      if (fs.existsSync(path)) {
        runtimeData = JSON.parse(await readFile(path, 'utf8'));
      }
      runtimeData[user.id] = user;
      await writeFile(path, JSON.stringify(runtimeData, null, 2));
      // Also need to update groups
      path = join(runtimeDir, 'groups.json');
      runtimeData = {};
      if (fs.existsSync(path)) {
        runtimeData = JSON.parse(await readFile(path, 'utf8'));
      }
      for (const group of user.groups) {
        const TFgroup = await groupsStore_async.get(group);
        if (TFgroup && !TFgroup.users.includes(user.id)) {
          TFgroup.users.push(user.id);
          await groupsStore_async.set(group, TFgroup);
          // Update the config
          runtimeData[group] = runtimeData[group] || {};
          runtimeData[group]["users"] = TFgroup.users;
        }
      }
      await writeFile(path, JSON.stringify(runtimeData, null, 2));
    }

    const deleteRuntimeUsers_async = async (username) => {
      const user = await usersStore_async.get(username);
      for (const id of user.groups) {
        let group = await groupsStore_async.get(id);
        if (group) {
          group.users = group.users.filter((u) => u !== username);
          await groupsStore_async.set(id, group);
        }
      }
      await usersStore_async.delete(username);
      // Read the config if it exists
      // Modify with user
      // Write the config
      const runtimeDir = join(__dirname, '../../../../../hub/db/config/runtime');
      let path = join(runtimeDir, 'users.json');
      //console.log("updateRuntimeUsers_async", __dirname, path, user);
      let runtimeData = {};
      if (fs.existsSync(path)) {
        runtimeData = JSON.parse(await readFile(path, 'utf8'));
      }
      delete runtimeData[user.id]
      await writeFile(path, JSON.stringify(runtimeData, null, 2));
      // Also need to update groups
      path = join(runtimeDir, 'groups.json');
      runtimeData = {};
      if (fs.existsSync(path)) {
        runtimeData = JSON.parse(await readFile(path, 'utf8'));
      }
      for (const groupId of user.groups) {
        const TFgroup = await groupsStore_async.get(groupId);
        if (TFgroup && !TFgroup.users.includes(user.id)) {
          TFgroup.users = TFgroup.users.filter((u) => u !== username);
          await groupsStore_async.set(groupId, TFgroup);
          // Update the config
          runtimeData[groupId] = runtimeData[groupId] || {};
          runtimeData[groupId]["users"] = TFgroup.users;
          if (TFgroup.users.length === 0) {
            delete runtimeData[groupId];
          }
        }
      }
      await writeFile(path, JSON.stringify(runtimeData, null, 2));
    }

    switch (T("state.current")) {
        case "start": {
          // permissions is the list of possible groups
          T("user.groups");
          break;
        }
        case "reactRequest": {
          utils.logTask(T(), "action", T("input.action"), utils.js(T("input")));
          const page = T("input.page") || 1;
          const limit = T("input.limit") || 10;
          const offset = (page - 1) * limit;
          switch (T("input.action")) {
            case "create": {
              const user = T("input.user");
              const password = T("input.password");
              // Check if the user already exists
              const count = await getRowCount_async(user.name);
              console.log("count", count);
              if (count > 0) {
                T("error", { message: "A user with this username already exists." });
              } else {
                // Insert the new user into the database
                const passwordHash = await hashPassword(password);
                await accessDB.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", [user.name, passwordHash]);
              }
              user["id"] = user.name;
              // We will need to save to the config file but that will be expanded
              // Write the user to runtime - read/modify/write
              updateRuntimeUsers_async(user);
              await usersResponse(limit, offset);
              T("commandDescription", "Created user " + user.name);
              break;
            }
            case "read": {
              const readUsername = T("input.user.name");
              const TFuser = await usersStore_async.get(readUsername);
              if (TFuser) {
                T("response.user", TFuser);
              } else {
                T("error", { message: "User not found." });
              }
              T("commandDescription", "Read user ");
              break;
            }
            case "update": {
              const user = T("input.user");
              const updateUsername = T("input.user.name");
              const newPassword = T("input.password");
              const newPasswordHash = await hashPassword(newPassword);
              await accessDB.run("UPDATE users SET password_hash = ? WHERE username = ?", [newPasswordHash, updateUsername]);
              T("commandDescription", "Updated user " + updateUsername);
              user["id"] = user.name;
              // We will need to save to the config file but that will be expanded
              // Write the user to runtime - read/modify/write
              updateRuntimeUsers_async(user);
              T("response.user", user);
              // After the update we reset the response.users array
              // Only the diff will be sent
              await usersResponse(limit, offset);
              break;
            }
            case "delete": {
              console.log(`Users before DB`, T("response.users"));
              const deleteUsernames = T("input.usernames");
              const deletedUsers = [];
              for (const username of deleteUsernames) {
                try {
                  const result = await deleteUser(username);
                  if (result.changes > 0) {
                    deletedUsers.push(result.username); // Add username to deletedUsers if it was deleted
                  }
                } catch (err) {
                  console.error(`Error deleting user ${username}:`, err);
                }
              } 
              if (deletedUsers.length > 0) {
                T("response.deletedUsers", deletedUsers);
              } else {
                T("error", { message: "No users found for deletion." });
              }
              T("commandDescription", `Deleted users: ${deletedUsers.join(", ")}`);
              // So we can see the users that are deleted (the diff will not remove entries that disappear from an array)
              await usersResponse(limit, offset);
              break;
            }
            case "readAll": {
              // Get all TF users
              //const userConfig = await configFunctions.buildTree_async(services["systemConfig"], "users"); // Get updated tree
              //const TFusers = userConfig.children;
              //console.log(`TFusers`, TFusers);
              utils.logTask(T(), "readAll", limit, offset);
              let users = await usersResponse(limit, offset);
              T("commandDescription", "Updated users ", users.length);
              utils.logTask(T(), "Users", users);
              break;
            }
          }
          T("state.current", "hubResponse");
          T("command", "update");
          utils.logTask(T(), "Action", T("commandDescription"));
          break;
        }
        case "hubResponse":
          // Wait for next action
          break;
        default:
          utils.logTask(T(), "WARNING unknown state : " + T("state.current"));
          return null;
      }
    
    return null;


  async function getRowCount_async(username) {
    return new Promise((resolve, reject) => {
      accessDB.get("SELECT COUNT(*) AS count FROM users WHERE username = ?", [username], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }
    
  async function getTotalUserCount_async() {
    let totalCount = 0;
    try {
      totalCount = await new Promise((resolve, reject) => {
        accessDB.get(`SELECT COUNT(*) AS count FROM users`, [], function (err, row) {
          if (err) {
            console.error(err.message);
            reject(err);
          } else {
            resolve(row.count);
          }
        });
      });
    } catch (err) {
      console.error(`Error getting total user count: ${err.message}`);
      // Depending on your error handling you might want to throw the error or handle it differently
      throw err;
    }
    return totalCount;
  }

  async function usersResponse(limit, offset) {
    let users = [];
    try {
      //"promisifying" the callback-based function. This is a common pattern when working with older Node.js libraries or APIs that haven't been updated to return Promises natively. Allows for use of try/catch
      users = await new Promise((resolve, reject) => {
        accessDB.all(`SELECT * FROM users ORDER BY username COLLATE NOCASE ASC LIMIT ? OFFSET ?`, [limit, offset], function (err, rows) {
          if (err) {
            console.error(err.message);
            reject(err);
          } else {
            //console.log(`Users returned`, rows);
            const strippedUsers = rows.map(user => {
              delete user.password_hash;
              return user;
            });
            resolve(strippedUsers);
          }
        })
        .on('error', (err) => {
          console.error('Error event caught:', err);
          reject(err); // This will also throw the error in a Promise context
        });
      });
    } catch (err) {
      T("error", { message: err.message });
    }
    console.log("Sorted users", users);
    users = await Promise.all(users.map(async (user) => {
      const TFuser = await usersStore_async.get(user.username);
      if (TFuser) {
        return TFuser;
      } else {
        user.name = user.username; // hack for the frontend
        // Handle the case where TFuser is not found
        console.error(`User ${user.username} not found in store.`);
        return user; // Or you might want to return null or handle it differently
      }
    }));
    T("response.users", users);
    let totalUserCount = await getTotalUserCount_async();
    T("response.totalUserCount", totalUserCount);
    return users;
  }

  async function deleteUser(username) {
    try {
      let result = await new Promise((resolve, reject) => {
        accessDB.run("DELETE FROM users WHERE username = ?", [username], function (err) {
          if (err) {
            console.error(err.message);
            reject(err);
          } else {
            // Remove this user from any groups
            resolve({ changes: this.changes, username }); // Include the username in the result
          }
        });
      });
      await deleteRuntimeUsers_async(username);
      return result;
    } catch (err) {
      console.error("Error deleting user:", err);
      throw err;
    }
  }

};

export { TaskUsers_async };
