package com.smr.storiesmadereal.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.painter.ColorPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import com.smr.storiesmadereal.ui.theme.SmrPalette

/**
 * The book cover on Now Playing, sitting on a soft dim cobalt bloom that radiates
 * from behind it rather than sitting on top -- a large blurred radial glow underneath
 * a smaller sharp cover image.
 */
@Composable
fun CoverWithGlow(
    coverArt: ImageBitmap?,
    modifier: Modifier = Modifier,
    contentDescription: String? = null
) {
    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .aspectRatio(1f)
                .blur(64.dp)
                .background(
                    brush = Brush.radialGradient(
                        colors = listOf(SmrPalette.CobaltGlowCore, SmrPalette.CobaltGlowEdge),
                        center = Offset.Unspecified
                    ),
                    shape = RoundedCornerShape(24.dp)
                )
        )

        Box(
            modifier = Modifier
                .padding(28.dp)
                .fillMaxWidth(0.66f)
                .aspectRatio(1f)
                .clip(RoundedCornerShape(18.dp))
        ) {
            if (coverArt != null) {
                Image(
                    bitmap = coverArt,
                    contentDescription = contentDescription,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth()
                )
            } else {
                Image(
                    painter = ColorPainter(SmrPalette.BaseElevated),
                    contentDescription = contentDescription,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}
