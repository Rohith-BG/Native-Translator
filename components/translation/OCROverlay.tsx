import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { OCRBlock } from '@/services/ocr/ocrService';
import { darkTheme, type as typeScale } from '@/constants/theme';

interface OCROverlayProps {
  blocks: OCRBlock[];
  imageWidth: number;
  imageHeight: number;
  displayWidth: number;
  displayHeight: number;
}

/**
 * Renders semi-transparent bounding boxes over detected text regions
 * in the source image.
 *
 * All coordinates are scaled from the original image dimensions to the
 * on-screen display dimensions.
 */
export const OCROverlay: React.FC<OCROverlayProps> = ({
  blocks,
  imageWidth,
  imageHeight,
  displayWidth,
  displayHeight,
}) => {
  if (!imageWidth || !imageHeight || blocks.length === 0) {
    return null;
  }

  const scaleX = displayWidth / imageWidth;
  const scaleY = displayHeight / imageHeight;

  return (
    <View style={[styles.overlay, { width: displayWidth, height: displayHeight }]}>
      {blocks.map((block, index) => {
        const { x, y, width, height } = block.boundingBox;
        return (
          <View
            key={`block-${index}`}
            style={[
              styles.boundingBox,
              {
                left: x * scaleX,
                top: y * scaleY,
                width: width * scaleX,
                height: height * scaleY,
              },
            ]}
          >
            <Text style={styles.blockIndex}>{index + 1}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  boundingBox: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 217, 255, 0.7)',
    backgroundColor: 'rgba(0, 217, 255, 0.08)',
    borderRadius: 4,
  },
  blockIndex: {
    position: 'absolute',
    top: -1,
    left: 2,
    backgroundColor: 'rgba(0, 217, 255, 0.85)',
    color: darkTheme.background,
    fontFamily: 'Inter_600SemiBold',
    fontSize: typeScale.caption - 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
});
