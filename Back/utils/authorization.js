function roleKey(name) {
  return String(name ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function hasPermission(authUser, permission) {
  return authUser?.permissions?.includes(permission) ?? false;
}

module.exports = { roleKey, hasPermission };
