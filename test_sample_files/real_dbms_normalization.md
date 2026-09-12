# Relational Database Normalization

Normalization organizes tables to reduce data redundancy and eliminate update anomalies.

## First Normal Form (1NF)
Each table column must contain atomic (indivisible) values.
No repeating groups or arrays allowed in tuples.

## Second Normal Form (2NF)
Must be in 1NF and contain no partial functional dependencies.
Every non-prime attribute must depend fully on the entire candidate key.

## Third Normal Form (3NF) & BCNF
Must be in 2NF and eliminate transitive functional dependencies (X -> Y and Y -> Z).
Boyce-Codd Normal Form (BCNF) strictly requires every determinant X to be a superkey.