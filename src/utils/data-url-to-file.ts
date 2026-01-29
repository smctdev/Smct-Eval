export function dataURLtoFile(dataURL: any, filename: string): File | null {
  // Return null if dataURL is invalid
  if (!dataURL || typeof dataURL !== 'string') {
    console.warn("Invalid dataURL provided to dataURLtoFile");
    return null;
  }

  // Check if it's a data URL format
  if (!dataURL.startsWith('data:')) {
    console.warn("dataURL is not in data URL format:", dataURL);
    return null;
  }

  try {
    const arr = dataURL.split(",");
    
    // Check if we have both parts (mime type and data)
    if (!arr || arr.length < 2) {
      console.warn("Invalid dataURL format - missing data part");
      return null;
    }

    // Extract mime type
    const mimeMatch = arr[0]?.match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) {
      console.warn("Could not extract mime type from dataURL");
      return null;
    }
    
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
  } catch (error) {
    console.error("Error converting dataURL to File:", error);
    return null;
  }
}
