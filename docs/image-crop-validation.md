# Image Crop Validation

## Current behavior

The current feature is an interactive crop workflow, not automatic face or subject detection.
`react-easy-crop` opens with a centered crop and zoom level 1; the user moves or zooms the image
before confirming each crop.

Character emotion images use two mandatory stages:

1. `CharacterForm.handleImageUpload` validates the file and opens `ImageCropModal`.
2. The user selects a 5:7 full portrait crop.
3. That portrait crop becomes the source for a required 1:1 emotion-avatar crop.
4. `getCroppedImageBlob` renders each selection to a WebP `Blob` in a browser canvas.
5. `CharacterForm` uploads both files as `image` and `avatar`.
6. `character.routes.ts` calls `processCharacterImagePair`.
7. The server writes a 500x700 AVIF portrait and a 512x512 AVIF avatar as one replaceable pair.

User profile avatars use the same modal with a single 1:1 crop. The server normalizes that result
to a 512x512 WebP through `processUserAvatar`.

## Validation results

The server tests generate isolated synthetic images and never read or replace real character
assets.

| Input                 | Result                                                                            |
| --------------------- | --------------------------------------------------------------------------------- |
| Portrait              | Accepted and normalized to the configured portrait/avatar dimensions.             |
| Landscape             | Accepted; the user chooses the visible crop before upload.                        |
| Square                | Accepted and normalized.                                                          |
| Very small (8x8)      | Accepted and upscaled; quality loss is expected.                                  |
| Transparent           | Accepted; alpha is retained in both AVIF outputs.                                 |
| Multiple subjects     | Accepted; no subject is chosen automatically. The user composes both crops.       |
| Subject near an edge  | Accepted; the user can reposition the crop to retain the subject.                 |
| No detectable subject | Accepted because no detector is used; ordinary manual cropping remains available. |

One defect was found and corrected: the second character crop previously retained the 5:7
portrait aspect ratio, then the server center-cropped that result to 1:1. The avatar stage now uses
a square crop, so the user sees and controls the final avatar composition.

## Storage and failure behavior

- The original upload is not persisted. It exists only as the browser `File`/data URL while the
  modal workflow is active.
- Crop coordinates, zoom, and crop metadata are not sent to the server or stored. Only the two
  rendered crop files are uploaded. Legacy `CropData` types are not part of this character flow.
- Character portrait and avatar files are generated before replacement and installed as a pair.
  Temporary and backup files provide rollback if replacement fails.
- Invalid or undecodable server input rejects the operation and leaves an existing pair unchanged.
- Unsupported MIME types and files over 5 MB are rejected before cropping. File read and
  CharacterForm processing failures show a toast. A canvas failure is logged and leaves the modal
  open so the user can cancel or retry.
- There is no detector-specific fallback because there is no detector.

## Automated coverage

- `packages/client/page/character/characterImageCrop.test.ts` locks the 5:7 portrait and 1:1
  avatar stages.
- `packages/server/util/imageProcessingUtils.test.ts` covers dimensions, small images,
  transparency, subject-agnostic inputs, output-file contents, decode failure, and rollback.

## Manual checklist

1. In character create/edit, upload portrait, landscape, square, very small, and transparent files.
2. Confirm the first modal is 5:7 and the second modal is square and cannot be skipped.
3. For multiple subjects and an edge-positioned face, move/zoom each crop and verify the preview
   matches the selection.
4. Upload an image with no obvious subject and confirm manual cropping still works.
5. Save, reload, and verify Book mode uses the full emotion portrait while Conversation mode uses
   the matching per-turn emotion avatar.
6. Replace an existing emotion image and verify its portrait and avatar update together.
7. Cancel during each crop stage and verify no partial image is saved.
8. Try an unsupported, oversized, or corrupt image and verify the current saved pair remains usable.
9. View a transparent result against the normal UI background and check that transparency renders
   as intended.
