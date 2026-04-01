import uuid
import logging
import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.book_recap import BookRecap


logger = logging.getLogger(__name__)

# Supported Tiptap extensions
SUPPORTED_NODE_TYPES = {
    "doc",
    "document",
    "paragraph",
    "text",
    "heading",
    "bulletList",
    "orderedList",
    "listItem",
    "bold",
    "italic",
    "code",
    "codeBlock",
    "image",
    "link",
    "horizontalRule",
    "blockquote",
    "hardBreak",
}

# Maximum content size: 5MB
MAX_CONTENT_SIZE = 5 * 1024 * 1024


def validate_and_clean_recap_content(content: dict) -> dict:
    """Validate Tiptap content and remove unsupported extensions."""
    if not isinstance(content, dict):
        return {}

    def clean_node(node: dict) -> dict | None:
        """Recursively clean a node, removing unsupported types."""
        if not isinstance(node, dict):
            return node

        node_type = node.get("type")

        # Only allow supported node types
        if node_type and node_type not in SUPPORTED_NODE_TYPES:
            logger.warning(f"Removing unsupported node type: {node_type}")
            return None

        # Recursively clean child nodes
        if "content" in node and isinstance(node["content"], list):
            cleaned_content = []
            for child in node["content"]:
                cleaned_child = clean_node(child)
                if cleaned_child is not None:
                    cleaned_content.append(cleaned_child)
            node["content"] = cleaned_content

        # For marks, also recursively clean
        if "marks" in node and isinstance(node["marks"], list):
            cleaned_marks = []
            for mark in node["marks"]:
                if isinstance(mark, dict) and mark.get("type") in SUPPORTED_NODE_TYPES:
                    cleaned_marks.append(mark)
            node["marks"] = cleaned_marks

        return node

    # Clean the root content
    cleaned = clean_node(content)
    return cleaned if cleaned else {}


async def create_or_update_recap(
    db: AsyncSession,
    book_id: uuid.UUID,
    created_by: uuid.UUID,
    title: str,
    content: dict,
) -> BookRecap:
    """Create or update a recap for a book."""
    # Validate book exists
    result = await db.execute(select(Book).where(Book.id == book_id))
    if result.scalar_one_or_none() is None:
        raise ValueError("Book not found")

    # Validate content size
    content_json = json.dumps(content)
    if len(content_json.encode('utf-8')) > MAX_CONTENT_SIZE:
        raise ValueError(f"Content exceeds maximum size of {MAX_CONTENT_SIZE / (1024*1024):.1f}MB")

    # Validate and clean content
    cleaned_content = validate_and_clean_recap_content(content)

    # Check if recap already exists
    result = await db.execute(
        select(BookRecap).where(BookRecap.book_id == book_id)
    )
    recap = result.scalar_one_or_none()

    if recap:
        # Update existing
        recap.title = title
        recap.content = cleaned_content
        recap.updated_at = datetime.now(timezone.utc)
    else:
        # Create new
        recap = BookRecap(
            book_id=book_id,
            author_id=created_by,
            title=title,
            content=cleaned_content,
        )
        db.add(recap)

    await db.commit()
    await db.refresh(recap)
    return recap


async def get_recap(
    db: AsyncSession,
    book_id: uuid.UUID,
) -> BookRecap | None:
    """Get recap for a book."""
    result = await db.execute(
        select(BookRecap).where(BookRecap.book_id == book_id)
    )
    return result.scalar_one_or_none()


async def delete_recap(
    db: AsyncSession,
    recap: BookRecap,
) -> None:
    """Delete a recap."""
    await db.delete(recap)
    await db.commit()
