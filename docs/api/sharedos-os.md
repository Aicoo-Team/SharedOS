[**SharedOS API v0.1.0-alpha.0**](README.md)

---

[SharedOS API](README.md) / @aicoo/sharedos-os

# @aicoo/sharedos-os

Standard permission-controlled file tool adapters for SharedOS.

```bash
npm install @aicoo/sharedos-os@next
```

Hosts provide storage implementations; this package provides one canonical
`files` namespace, portable argument schemas, canonical resource paths, exact
per-call capability resolution, and tool definitions. Memory is represented by
files under host-defined paths, not by a second storage namespace.

The standard handlers also use `files` as their logical tool namespace and
`sharedos` as their catalog source. Hosts must explicitly include `files` in an
effective namespace selection before those handlers can be discovered.
Filesystem providers must still enforce root containment and reject symlink
escapes.

SharedOS is currently an `0.x` prerelease.

## Interfaces

### StandardOsProviders

Defined in: [index.ts:121](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L121)

#### Properties

| Property                             | Modifier   | Type                                                    | Defined in                                                                                     |
| ------------------------------------ | ---------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| <a id="property-files"></a> `files?` | `readonly` | [`ResourceProvider`](sharedos-core.md#resourceprovider) | [index.ts:122](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L122) |

## Type Aliases

### FilePath

> **FilePath** = `z.infer`\<_typeof_ [`FilePathSchema`](#filepathschema)>\>

Defined in: [index.ts:23](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L23)

---

### FilesAppendArguments

> **FilesAppendArguments** = `z.infer`\<_typeof_ [`FilesAppendArgumentsSchema`](#filesappendargumentsschema)>\>

Defined in: [index.ts:75](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L75)

---

### FilesCreateArguments

> **FilesCreateArguments** = `z.infer`\<_typeof_ [`FilesCreateArgumentsSchema`](#filescreateargumentsschema)>\>

Defined in: [index.ts:56](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L56)

---

### FilesDeleteArguments

> **FilesDeleteArguments** = `z.infer`\<_typeof_ [`FilesDeleteArgumentsSchema`](#filesdeleteargumentsschema)>\>

Defined in: [index.ts:84](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L84)

---

### FilesGrepArguments

> **FilesGrepArguments** = `z.infer`\<_typeof_ [`FilesGrepArgumentsSchema`](#filesgrepargumentsschema)>\>

Defined in: [index.ts:47](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L47)

---

### FilesPathArguments

> **FilesPathArguments** = `z.infer`\<_typeof_ [`FilesPathArgumentsSchema`](#filespathargumentsschema)>\>

Defined in: [index.ts:26](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L26)

---

### FilesReplaceArguments

> **FilesReplaceArguments** = `z.infer`\<_typeof_ [`FilesReplaceArgumentsSchema`](#filesreplaceargumentsschema)>\>

Defined in: [index.ts:65](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L65)

---

### FilesSearchArguments

> **FilesSearchArguments** = `z.infer`\<_typeof_ [`FilesSearchArgumentsSchema`](#filessearchargumentsschema)>\>

Defined in: [index.ts:35](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L35)

---

### FilesSnapshotCreateArguments

> **FilesSnapshotCreateArguments** = `z.infer`\<_typeof_ [`FilesSnapshotCreateArgumentsSchema`](#filessnapshotcreateargumentsschema)>\>

Defined in: [index.ts:92](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L92)

---

### FilesSnapshotListArguments

> **FilesSnapshotListArguments** = `z.infer`\<_typeof_ [`FilesSnapshotListArgumentsSchema`](#filessnapshotlistargumentsschema)>\>

Defined in: [index.ts:100](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L100)

---

### FilesSnapshotRestoreArguments

> **FilesSnapshotRestoreArguments** = `z.infer`\<_typeof_ [`FilesSnapshotRestoreArgumentsSchema`](#filessnapshotrestoreargumentsschema)>\>

Defined in: [index.ts:109](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L109)

## Variables

### FilePathSchema

> `const` **FilePathSchema**: `ZodArray`\<`ZodString`, `"many"`>\>

Defined in: [index.ts:22](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L22)

---

### FILES\_NAMESPACE

> `const` **FILES\_NAMESPACE**: `"files"` = `"files"`

Defined in: [index.ts:19](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L19)

The canonical SharedOS resource plane. Memory is a role of files, not a second store.

---

### FilesAppendArgumentsSchema

> `const` **FilesAppendArgumentsSchema**: `ZodObject`\<\{ `content`: `ZodType`\<[`JsonValue`](sharedos-contracts.md#jsonvalue), `ZodTypeDef`, [`JsonValue`](sharedos-contracts.md#jsonvalue)>\>; `expectedVersion`: `ZodOptional`\<`ZodString`>\>; `metadata`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodType`\<[`JsonValue`](sharedos-contracts.md#jsonvalue), `ZodTypeDef`, [`JsonValue`](sharedos-contracts.md#jsonvalue)>>>\>\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `content`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `expectedVersion?`: `string`; `metadata?`: `Record`\<`string`, [`JsonValue`](sharedos-contracts.md#jsonvalue)>\>; `path`: `string`[]; \}, \{ `content`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `expectedVersion?`: `string`; `metadata?`: `Record`\<`string`, [`JsonValue`](sharedos-contracts.md#jsonvalue)>\>; `path`: `string`[]; \}\>

Defined in: [index.ts:67](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L67)

---

### FilesCreateArgumentsSchema

> `const` **FilesCreateArgumentsSchema**: `ZodObject`\<\{ `content`: `ZodType`\<[`JsonValue`](sharedos-contracts.md#jsonvalue), `ZodTypeDef`, [`JsonValue`](sharedos-contracts.md#jsonvalue)>\>; `metadata`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodType`\<[`JsonValue`](sharedos-contracts.md#jsonvalue), `ZodTypeDef`, [`JsonValue`](sharedos-contracts.md#jsonvalue)>>>\>\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `content`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `metadata?`: `Record`\<`string`, [`JsonValue`](sharedos-contracts.md#jsonvalue)>\>; `path`: `string`[]; \}, \{ `content`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `metadata?`: `Record`\<`string`, [`JsonValue`](sharedos-contracts.md#jsonvalue)>\>; `path`: `string`[]; \}\>

Defined in: [index.ts:49](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L49)

---

### FilesDeleteArgumentsSchema

> `const` **FilesDeleteArgumentsSchema**: `ZodObject`\<\{ `expectedVersion`: `ZodOptional`\<`ZodString`>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; `recursive`: `ZodDefault`\<`ZodBoolean`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `expectedVersion?`: `string`; `path`: `string`[]; `recursive`: `boolean`; \}, \{ `expectedVersion?`: `string`; `path`: `string`[]; `recursive?`: `boolean`; \}\>

Defined in: [index.ts:77](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L77)

---

### FilesGrepArgumentsSchema

> `const` **FilesGrepArgumentsSchema**: `ZodObject`\<\{ `caseSensitive`: `ZodDefault`\<`ZodBoolean`>\>; `contextAfter`: `ZodDefault`\<`ZodNumber`>\>; `contextBefore`: `ZodDefault`\<`ZodNumber`>\>; `mode`: `ZodDefault`\<`ZodEnum`\<\[`"literal"`, `"regex"`\]\>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; `pattern`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `caseSensitive`: `boolean`; `contextAfter`: `number`; `contextBefore`: `number`; `mode`: `"literal"` \| `"regex"`; `path`: `string`[]; `pattern`: `string`; \}, \{ `caseSensitive?`: `boolean`; `contextAfter?`: `number`; `contextBefore?`: `number`; `mode?`: `"literal"` \| `"regex"`; `path`: `string`[]; `pattern`: `string`; \}\>

Defined in: [index.ts:37](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L37)

---

### FilesPathArgumentsSchema

> `const` **FilesPathArgumentsSchema**: `ZodObject`\<\{ `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `path`: `string`[]; \}, \{ `path`: `string`[]; \}\>

Defined in: [index.ts:25](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L25)

---

### FilesReplaceArgumentsSchema

> `const` **FilesReplaceArgumentsSchema**: `ZodObject`\<\{ `content`: `ZodType`\<[`JsonValue`](sharedos-contracts.md#jsonvalue), `ZodTypeDef`, [`JsonValue`](sharedos-contracts.md#jsonvalue)>\>; `expectedVersion`: `ZodOptional`\<`ZodString`>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `content`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `expectedVersion?`: `string`; `path`: `string`[]; \}, \{ `content`: [`JsonValue`](sharedos-contracts.md#jsonvalue); `expectedVersion?`: `string`; `path`: `string`[]; \}\>

Defined in: [index.ts:58](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L58)

---

### FilesSearchArgumentsSchema

> `const` **FilesSearchArgumentsSchema**: `ZodObject`\<\{ `limit`: `ZodOptional`\<`ZodNumber`>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; `query`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `limit?`: `number`; `path`: `string`[]; `query`: `string`; \}, \{ `limit?`: `number`; `path`: `string`[]; `query`: `string`; \}\>

Defined in: [index.ts:28](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L28)

---

### FilesSnapshotCreateArgumentsSchema

> `const` **FilesSnapshotCreateArgumentsSchema**: `ZodObject`\<\{ `label`: `ZodOptional`\<`ZodString`>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `label?`: `string`; `path`: `string`[]; \}, \{ `label?`: `string`; `path`: `string`[]; \}\>

Defined in: [index.ts:86](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L86)

---

### FilesSnapshotListArgumentsSchema

> `const` **FilesSnapshotListArgumentsSchema**: `ZodObject`\<\{ `limit`: `ZodOptional`\<`ZodNumber`>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; \}, `"strict"`, `ZodTypeAny`, \{ `limit?`: `number`; `path`: `string`[]; \}, \{ `limit?`: `number`; `path`: `string`[]; \}\>

Defined in: [index.ts:94](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L94)

---

### FilesSnapshotRestoreArgumentsSchema

> `const` **FilesSnapshotRestoreArgumentsSchema**: `ZodObject`\<\{ `expectedVersion`: `ZodOptional`\<`ZodString`>\>; `path`: `ZodArray`\<`ZodString`, `"many"`>\>; `snapshotId`: `ZodString`; \}, `"strict"`, `ZodTypeAny`, \{ `expectedVersion?`: `string`; `path`: `string`[]; `snapshotId`: `string`; \}, \{ `expectedVersion?`: `string`; `path`: `string`[]; `snapshotId`: `string`; \}\>

Defined in: [index.ts:102](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L102)

---

### SHAREDOS\_TOOL\_SOURCE

> `const` **SHAREDOS\_TOOL\_SOURCE**: `"sharedos"` = `"sharedos"`

Defined in: [index.ts:20](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L20)

## Functions

### createFileTools()

> **createFileTools**(`provider`): readonly [`ToolHandler`](sharedos-core.md#toolhandler)[]

Defined in: [index.ts:143](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L143)

Portable file tools over one host-owned provider.

A host may expose roots such as Raw, Memory, Workspace, and Wiki, but they
remain paths in this one resource plane. Search indexes and context mounts
must preserve the same file grants; they are not independent authority.

#### Parameters

| Parameter  | Type                                                    |
| ---------- | ------------------------------------------------------- |
| `provider` | [`ResourceProvider`](sharedos-core.md#resourceprovider) |

#### Returns

readonly [`ToolHandler`](sharedos-core.md#toolhandler)[]

---

### registerStandardOsTools()

> **registerStandardOsTools**(`kernel`, `providers`): `void`

Defined in: [index.ts:125](https://github.com/Aicoo-Team/SharedOS/blob/main/packages/os/src/index.ts#L125)

#### Parameters

| Parameter   | Type                                                                            |
| ----------- | ------------------------------------------------------------------------------- |
| `kernel`    | `Pick`\<[`SharedOSKernel`](sharedos-core.md#sharedoskernel), `"registerTool"`\> |
| `providers` | [`StandardOsProviders`](#standardosproviders)                                   |

#### Returns

`void`
