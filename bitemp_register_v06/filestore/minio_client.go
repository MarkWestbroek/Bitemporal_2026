// Package filestore biedt een MinIO client wrapper voor bestandsopslag.
// Wordt gebruikt door de bestandenhandlers voor upload/download van bestanden
// die te groot zijn voor inline opslag in de database.
package filestore

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Client houdt de MinIO-verbinding en configuratie bij.
type Client struct {
	minio  *minio.Client
	bucket string
}

// Beschikbaar geeft aan of de MinIO client succesvol geïnitialiseerd is.
// Wanneer false, worden alleen inline (database) opslag gebruikt.
var Beschikbaar bool

// instance is de globale filestore client (nil als MinIO niet geconfigureerd is).
var instance *Client

// Huidig geeft de globale filestore client terug, of nil als niet beschikbaar.
func Huidig() *Client {
	return instance
}

// Init initialiseert de MinIO client op basis van omgevingsvariabelen.
// Als MINIO_ENDPOINT niet is ingesteld, wordt MinIO overgeslagen (graceful degradation).
// Verwachte env vars: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_USE_SSL.
func Init() error {
	endpoint := os.Getenv("MINIO_ENDPOINT")
	if endpoint == "" {
		fmt.Println("MINIO_ENDPOINT niet ingesteld — bestandsopslag beperkt tot inline (database).")
		Beschikbaar = false
		return nil
	}

	accessKey := os.Getenv("MINIO_ACCESS_KEY")
	secretKey := os.Getenv("MINIO_SECRET_KEY")
	bucket := os.Getenv("MINIO_BUCKET")
	if bucket == "" {
		bucket = "ide-bestanden"
	}
	useSSL := strings.EqualFold(os.Getenv("MINIO_USE_SSL"), "true")

	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return fmt.Errorf("minio client initialisatie mislukt: %w", err)
	}

	// Controleer of de bucket bestaat, maak aan als dat niet zo is.
	ctx := context.Background()
	exists, err := client.BucketExists(ctx, bucket)
	if err != nil {
		return fmt.Errorf("minio bucket check mislukt: %w", err)
	}
	if !exists {
		err = client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{})
		if err != nil {
			return fmt.Errorf("minio bucket aanmaken mislukt: %w", err)
		}
		fmt.Printf("MinIO bucket '%s' aangemaakt.\n", bucket)
	}

	instance = &Client{minio: client, bucket: bucket}
	Beschikbaar = true
	fmt.Printf("MinIO verbonden: endpoint=%s, bucket=%s, ssl=%t\n", endpoint, bucket, useSSL)
	return nil
}

// UploadResultaat bevat de resultaten van een upload.
type UploadResultaat struct {
	ObjectKey  string
	SHA256Hash string
	Grootte    int64
}

// Upload slaat een bestand op in MinIO en berekent de SHA-256 hash.
// De objectKey wordt gebruikt als pad in de bucket.
func (c *Client) Upload(ctx context.Context, objectKey string, reader io.Reader, size int64, contentType string) (*UploadResultaat, error) {
	// Lees de data in om de hash te berekenen, schrijf daarna naar MinIO.
	// Voor grote bestanden zou een tee-reader beter zijn, maar voor IDE-bestanden
	// (doorgaans < 50 MB) is dit acceptabel.
	hasher := sha256.New()
	teeReader := io.TeeReader(reader, hasher)

	opts := minio.PutObjectOptions{
		ContentType: contentType,
	}

	info, err := c.minio.PutObject(ctx, c.bucket, objectKey, teeReader, size, opts)
	if err != nil {
		return nil, fmt.Errorf("minio upload mislukt voor '%s': %w", objectKey, err)
	}

	return &UploadResultaat{
		ObjectKey:  objectKey,
		SHA256Hash: hex.EncodeToString(hasher.Sum(nil)),
		Grootte:    info.Size,
	}, nil
}

// Download haalt een bestand op uit MinIO en geeft een io.ReadCloser terug.
// De aanroeper is verantwoordelijk voor het sluiten van de reader.
func (c *Client) Download(ctx context.Context, objectKey string) (io.ReadCloser, string, int64, error) {
	obj, err := c.minio.GetObject(ctx, c.bucket, objectKey, minio.GetObjectOptions{})
	if err != nil {
		return nil, "", 0, fmt.Errorf("minio download mislukt voor '%s': %w", objectKey, err)
	}

	stat, err := obj.Stat()
	if err != nil {
		obj.Close()
		return nil, "", 0, fmt.Errorf("minio stat mislukt voor '%s': %w", objectKey, err)
	}

	return obj, stat.ContentType, stat.Size, nil
}

// Verwijder verwijdert een object uit MinIO.
func (c *Client) Verwijder(ctx context.Context, objectKey string) error {
	err := c.minio.RemoveObject(ctx, c.bucket, objectKey, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("minio verwijdering mislukt voor '%s': %w", objectKey, err)
	}
	return nil
}

// Bestaat controleert of een object bestaat in MinIO.
func (c *Client) Bestaat(ctx context.Context, objectKey string) (bool, error) {
	_, err := c.minio.StatObject(ctx, c.bucket, objectKey, minio.StatObjectOptions{})
	if err != nil {
		errResp := minio.ToErrorResponse(err)
		if errResp.Code == "NoSuchKey" {
			return false, nil
		}
		return false, fmt.Errorf("minio stat mislukt voor '%s': %w", objectKey, err)
	}
	return true, nil
}

// BerekenSHA256 berekent de SHA-256 hash van data.
func BerekenSHA256(data []byte) string {
	h := sha256.Sum256(data)
	return hex.EncodeToString(h[:])
}
