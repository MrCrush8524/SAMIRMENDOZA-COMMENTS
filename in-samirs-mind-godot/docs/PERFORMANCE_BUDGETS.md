# PERFORMANCE BUDGETS

Prioritize responsive movement and clean image quality.

- Load one chapter at a time.
- Stream long music.
- Load TV video only when needed.
- Use MultiMesh for repeated props.
- Bake lighting.
- Keep dynamic lights and transparency rare.
- Use simple colliders.
- Use LOD and room visibility control.
- Keep hero textures larger; incidental props smaller.
- Do not solve mobile performance by permanently rendering at visibly jagged resolution.

Reduce in this order:
1. dynamic shadow cost
2. light count
3. particles
4. distant decoration
5. reflection complexity
6. LOD distances
7. post effects
8. only then modest dynamic render scale
