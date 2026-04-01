import re
import os

filepath = "/Users/mac/go/src/emoji/backend/internal/videojobs/processor_pipeline.go"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# We will create pipeline_gif.go which is exactly processor_pipeline.go but renamed process -> processGIF
gif_content = content.replace("func (p *Processor) process(ctx context.Context, jobID uint64) error {", "func (p *Processor) processGIF(ctx context.Context, jobID uint64) error {")
with open("/Users/mac/go/src/emoji/backend/internal/videojobs/pipeline_gif.go", "w", encoding="utf-8") as f:
    f.write(gif_content)

# We will create pipeline_png.go which is exactly processor_pipeline.go but renamed process -> processPNG
png_content = content.replace("func (p *Processor) process(ctx context.Context, jobID uint64) error {", "func (p *Processor) processPNG(ctx context.Context, jobID uint64) error {")
with open("/Users/mac/go/src/emoji/backend/internal/videojobs/pipeline_png.go", "w", encoding="utf-8") as f:
    f.write(png_content)

# Now we rewrite processor_pipeline.go to only act as dispatcher
new_pipeline = """package videojobs

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"emoji/internal/models"

	"github.com/hibiken/asynq"
	"gorm.io/gorm"
)

func (p *Processor) process(ctx context.Context, jobID uint64) error {
	var job models.VideoJob
	if err := p.db.First(&job, jobID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("%w: video job not found", asynq.SkipRetry)
		}
		return err
	}
	
	requestedFormats := normalizeOutputFormats(job.OutputFormats)
	if containsString(requestedFormats, "gif") {
		return p.processGIF(ctx, jobID)
	} else if containsString(requestedFormats, "png") || containsString(requestedFormats, "jpg") || containsString(requestedFormats, "webp") {
		return p.processPNG(ctx, jobID)
	}

	// Default fallback to old behavior or PNG
	return p.processPNG(ctx, jobID)
}
"""
with open(filepath, "w", encoding="utf-8") as f:
    f.write(new_pipeline)
print("Split done.")
