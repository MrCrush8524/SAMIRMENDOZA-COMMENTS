package com.smr.storiesmadereal.ui.screens.library

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.smr.storiesmadereal.data.model.Manuscript
import com.smr.storiesmadereal.ui.theme.SmrPalette

@Composable
fun LibraryScreen(
    onOpenDrawer: () -> Unit,
    onManuscriptSelected: () -> Unit,
    viewModel: LibraryViewModel = viewModel(factory = LibraryViewModel.Factory(LocalContext.current))
) {
    val manuscripts by viewModel.manuscripts.collectAsState()
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { viewModel.importManuscript(it) }
    }

    Scaffold(
        containerColor = SmrPalette.Base,
        topBar = {
            TopAppBar(
                title = { Text("Library", color = SmrPalette.Cream) },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) {
                        Icon(Icons.Filled.Menu, contentDescription = "Menu", tint = SmrPalette.Lavender)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SmrPalette.Base)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { importLauncher.launch("text/plain") },
                containerColor = SmrPalette.Lavender
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Import manuscript", tint = SmrPalette.Base)
            }
        }
    ) { padding ->
        if (manuscripts.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center
            ) {
                Text("Your library is empty", color = SmrPalette.Cream, style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(8.dp))
                Text("Tap + to import a manuscript (.txt) from your device.", color = SmrPalette.CreamDim, style = MaterialTheme.typography.bodyMedium)
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
                items(manuscripts, key = { it.id }) { manuscript ->
                    ManuscriptRow(
                        manuscript = manuscript,
                        onClick = {
                            viewModel.selectManuscript(manuscript)
                            onManuscriptSelected()
                        },
                        onDelete = { viewModel.deleteManuscript(manuscript) }
                    )
                }
            }
        }
    }
}

@Composable
private fun ManuscriptRow(manuscript: Manuscript, onClick: () -> Unit, onDelete: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(manuscript.title, color = SmrPalette.Cream, style = MaterialTheme.typography.titleMedium)
            Text(
                "${manuscript.wordCount} words · ~${manuscript.durationEstimateSeconds / 60} min",
                color = SmrPalette.CreamDim,
                style = MaterialTheme.typography.labelSmall
            )
        }
        IconButton(onClick = onDelete) {
            Icon(Icons.Filled.Delete, contentDescription = "Delete", tint = SmrPalette.Error)
        }
    }
}
