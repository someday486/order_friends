import sys

filepath = r'c:\dev\order_friends\apps\web\src\app\customer\categories\page.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the Category List comment
start_idx = None
for i, line in enumerate(lines):
    if '{/* Category List */}' in line:
        start_idx = i
        break

if start_idx is None:
    print("ERROR: Could not find {/* Category List */} marker")
    sys.exit(1)

print(f"Found start marker at line {start_idx + 1}: {lines[start_idx].rstrip()}")

# Find the closing </div> of the rounded-xl container
# Count <div> depth starting from line after the comment
end_idx = None
depth = 0
for i in range(start_idx + 1, len(lines)):
    stripped = lines[i].strip()
    # Count opening <div (exclude self-closing and those in attributes/strings)
    if stripped.startswith('<div'):
        depth += 1
    # Count closing </div>
    if stripped == '</div>':
        depth -= 1
        if depth == 0:
            end_idx = i
            break

if end_idx is None:
    print("ERROR: Could not find matching closing </div>")
    sys.exit(1)

print(f"Found end marker at line {end_idx + 1}: {lines[end_idx].rstrip()}")

new_block = """              {/* Category List */}
              <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
                {isSingleBranchMode ? (
                  filteredCategories.length === 0 ? (
                    <div className="py-8 text-center text-sm text-text-tertiary">
                      {categorySearch ? "검색 결과가 없습니다" : "카테고리가 없습니다"}
                    </div>
                  ) : !isSearchActive && canReorder ? (
                    <SortableList
                      items={filteredCategories}
                      keyExtractor={(c) => c.id}
                      onReorder={(next) => void handleReorder(next)}
                      renderItem={renderCategoryRow}
                    />
                  ) : (
                    filteredCategories.map((category, index) => (
                      <Fragment key={category.id}>{renderCategoryRow(category, index)}</Fragment>
                    ))
                  )
                ) : (
                  filteredGroupedCategories.length === 0 ? (
                    <div className="py-8 text-center text-sm text-text-tertiary">
                      {categorySearch ? "검색 결과가 없습니다" : "카테고리가 없습니다"}
                    </div>
                  ) : !isSearchActive && canReorder ? (
                    <SortableList
                      items={filteredGroupedCategories}
                      keyExtractor={(g) => g.key}
                      onReorder={(nextGroups) => void handleGroupReorder(nextGroups)}
                      renderItem={renderGroupRow}
                    />
                  ) : (
                    filteredGroupedCategories.map((group, index) => (
                      <Fragment key={group.key}>{renderGroupRow(group, index)}</Fragment>
                    ))
                  )
                )}
              </div>
"""

result = lines[:start_idx] + [new_block] + lines[end_idx + 1:]

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(result)

print(f"Successfully replaced lines {start_idx + 1}-{end_idx + 1} ({end_idx - start_idx + 1} lines) with {new_block.count(chr(10))} lines")
