#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing comment preservation with in-place job updates...\n');

try {
  // Run the flowcraft command
  console.log('Running: flowcraft generate --config tests/fixtures/test-config.json --pipeline tests/fixtures/pipeline-user-modified.yml --output-pipeline tests/fixtures/pipeline-preserve-comments.yml --verbose');
  
  const result = execSync('flowcraft generate --config tests/fixtures/test-config.json --pipeline tests/fixtures/pipeline-user-modified.yml --output-pipeline tests/fixtures/pipeline-preserve-comments.yml --verbose', {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  console.log('✅ Command executed successfully\n');
  console.log('Output:', result);
  
  // Check if the output file was created
  const outputPath = 'tests/fixtures/pipeline-preserve-comments.yml';
  if (fs.existsSync(outputPath)) {
    console.log('\n📄 Generated file exists. Checking comment positions...\n');
    
    // Read and analyze the generated file
    const generatedContent = fs.readFileSync(outputPath, 'utf8');
    
    // Check for comments before job names
    const changesJobMatch = generatedContent.match(/(# =+[\s\S]*?# =+[\s\S]*?)(\s*changes:)/);
    if (changesJobMatch) {
      console.log('✅ Found comments before changes job:');
      console.log(changesJobMatch[1]);
    } else {
      console.log('❌ No comments found before changes job');
    }
    
    // Show the changes job section
    const changesSection = generatedContent.match(/(# =+[\s\S]*?# =+[\s\S]*?changes:[\s\S]*?)(?=\n\s*[a-zA-Z]|\n\s*#|\n$)/);
    if (changesSection) {
      console.log('\n📋 Changes job section:');
      console.log(changesSection[1]);
    }
    
  } else {
    console.log('❌ Output file was not created');
  }
  
} catch (error) {
  console.error('❌ Error running command:', error.message);
  if (error.stdout) console.log('STDOUT:', error.stdout);
  if (error.stderr) console.log('STDERR:', error.stderr);
}
